#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'faye/websocket'
require 'erb'
require 'lodqa'
require 'lodqa/runner'
require 'lodqa/bs_client'
require 'term/finder'
require 'json'
require 'open-uri'
require 'cgi/util'
require 'uri'
require 'logger/async'
require 'logger/logger'
require 'lodqa/lodqa'
require 'lodqa/source_channel'
require 'lodqa/sparqls_count'

class LodqaWS < Sinatra::Base
	configure do
		set :root, File.dirname(__FILE__).gsub(/\/lib/, '')
		set :protection, :except => :frame_options
		set :server, 'thin'
		set :target_db, 'http://targets.lodqa.org/targets'
		# set :target_db, 'http://localhost:3000/targets'
		set :url_forwading_db, ENV['URL_FORWARDING_DB'] || 'http://urilinks.lodqa.org'

		enable :logging
		use Rack::CommonLogger, Logger.new("#{settings.root}/log/#{settings.environment}.log", 10, 10 * 1024 * 1024)
	end

	before do
		if request.content_type && request.content_type.downcase.include?('application/json')
			body = request.body.read
			begin
				json_params = JSON.parse body unless body.empty?
				json_params = {'keywords' => json_params} if json_params.is_a? Array
			rescue
				@error_message = 'ill-formed JSON string'
			end

			params.merge!(json_params) unless json_params.nil?
		end
	end

	get '/' do
		begin
			logger.info "access /"
			set_query_instance_variable

			applicants = applicants_dataset(params[:target])
			@sample_queries = sample_queries_for applicants, params

			@config = dataset_config_of params[:target] if present_in? params, :target
			erb :index
		rescue Lodqa::SourceError
			[503, 'Failed to connect the Target Database.']
		end
	end

	post '/template.json' do
		begin
			# Change value to Logger::DEBUG to log for debugging.
			Logger::Logger.level = Logger::INFO

			set_query_instance_variable

			string = params['string']
			language = params['language'] || 'en'

			raise ArgumentError, "The parameter 'string' is missing." unless string
			raise ArgumentError, "Currently only queries in English is accepted." unless language == 'en'

			template = Lodqa::Graphicator.new(parser_url).parse(string).template
			template = [template]

			headers 'Content-Type' => 'application/json'
			body template.to_json
		end
	end

	get '/answer' do
		if params['search_id']
			# Get query from the LODQA_BS
			begin
				response = RestClient.get "#{ENV['LODQA_BS']}/searches/#{params['search_id']}"
				@query = JSON.parse(response.body)['query']
			rescue Errno::ECONNREFUSED, Net::OpenTimeout, SocketError => e
				Logger::Logger.error e
			end
		else
			set_query_instance_variable
		end

		@target = params['target'] if present_in? params, :target

		applicants = applicants_dataset(params[:target])
		if applicants.length > 0
			erb :answer
		else
			response.status = 404
			body 'No dataset found'
		end
	end

	get '/grapheditor' do
		logger.info "access /grapheditor"
		set_query_instance_variable

		# Set a parameter of candidates of the target
		@targets = get_targets

		# Set a parameter of the target
		@target = params['target'] || @targets.first
		@endpoint_url = dataset_config_of(@target)[:endpoint_url]
		@need_proxy = @target == 'biogateway'

		if @query
			@pgp = Lodqa::PGPFactory.create parser_url, params['query']
		end

		erb :grapheditor
	end

	# Command for test: curl -H "content-type:application/json" -d '{"keywords":["drug", "genes"]} http://localhost:9292/termfinder'
	post '/termfinder' do
		begin
			tf = Term::Finder.new params[:dictionary_url]
			keywords = params[:'keywords']
			mappings = tf.find keywords

			headers \
				"Access-Control-Allow-Origin" => "*"
			content_type :json
			mappings.to_json
		rescue Term::FindError
			status 502
		end
	end

	options '/termfinder' do
		headers \
			"Access-Control-Allow-Origin" => "*",
			"Access-Control-Allow-Headers" => "Content-Type"
	end

	# Websocket only!
	get '/show_progress' do
		return [400, 'Please use websocket'] unless Faye::WebSocket.websocket?(env)
		return [400] unless present_in? params, :search_id # serach id is requeired

		# Change value to Logger::DEBUG to log for debugging.
		Logger::Logger.level =  Logger::INFO

		ws = Faye::WebSocket.new(env)
		request_id = Logger::Logger.generate_request_id

		show_progress_in_lodqa_bs ws, request_id, params[:search_id]

		return ws.rack_response
	end

	# Websocket only!
	get '/register_query' do
		return [400, 'Please use websocket'] unless Faye::WebSocket.websocket?(env)
		return [400] unless present_in? params, :query # query is requeired

		# Change value to Logger::DEBUG to log for debugging.
		Logger::Logger.level =  Logger::INFO

		ws = Faye::WebSocket.new(env)

		request_id = Logger::Logger.generate_request_id
		applicants = applicants_dataset params[:target]

		register_query ws, request_id, parser_url, applicants, params['read_timeout'], params['sparql_limit'], params['answer_limit'], params['query'], params[:target]

		return ws.rack_response
	end

	post '/requests/:request_id/simple/events' do
		# The params depends on thread variables.
		request_id = params[:request_id]

		ws = Lodqa::BSClient.socket_for request_id
		params[:events]
			.map do |e|
				e['event'] = "simple:#{e['event']}"
				e
			end
			.each { | e | ws.send e.to_json } if ws

		[200]
	end

	post '/requests/:request_id/expert/events' do
		# The params depends on thread variables.
		request_id = params[:request_id]

		ws = Lodqa::BSClient.socket_for request_id
		sparql_numbers_max = events_sparql_numbers_max(params[:events])

		params[:events]
			.select { |item| item['event'] == 'solutions' || item['event'] == 'anchored_pgp' }
			.map do |e|
				e['event'] = "expert:#{e['event'].gsub('solutions', 'solution')}"
				e['sparql'] = e['sparql']['query'] if e['sparql']
				e
			end
			.each { | e | ws.send e.to_json } if ws
		ws.close if ws && Lodqa::SparqlsCount.get_sparql_count(request_id) == sparql_numbers_max
		[200]
	end

	# Dummy API for a callback URL for LODQA BS
	post '/requests/:request_id/black_hall' do
		[200]
	end

	get '/solutions' do
		return [400, 'Please use websocket'] unless Faye::WebSocket.websocket?(env)
		return [400, 'target parameter is required'] unless present_in? params, :target

		# Change value to Logger::DEBUG to log for debugging.
		Logger::Logger.level = Logger::INFO

		begin
			request_id = Logger::Logger.generate_request_id
			ws = Faye::WebSocket.new(env)

			ws.on :message do |event|
				Logger::Logger.request_id = request_id
				json = JSON.parse(event.data, {:symbolize_names => true})

				pgp = json[:pgp]
				mappings = json[:mappings]

				start_and_sparql_count ws, params[:target], params[:read_timeout], params[:sparql_limit], params[:answer_limit], pgp, mappings, request_id
				register_pgp_and_mappings ws, params[:target], params[:read_timeout], params[:sparql_limit], params[:answer_limit], pgp, mappings, request_id
			end

			ws.rack_response
		rescue => e
			Logger::Logger.error e, request: request.env
			[500, e.message]
		end
	end

	# Comman for test: curl 'http://localhost:9292/proxy?endpoint=http://www.semantic-systems-biology.org/biogateway/endpoint&query=select%20%3Flabel%20where%20%7B%20%3Chttp%3A%2F%2Fpurl.obolibrary.org%2Fobo%2Fvario%23associated_with%3E%20%20rdfs%3Alabel%20%3Flabel%20%7D'
	get '/proxy' do
		endpoint = params['endpoint']
		query = params['query']
		begin
			open("#{endpoint}?query=#{CGI.escape(query)}", 'accept' => 'application/json') {|f|
				content_type :json
			  f.string
			}
		rescue OpenURI::HTTPError
			status 502
		end
	end

	not_found do
		"unknown path.\n"
	end

	error do
	  env['sinatra.error'].message + "\n"
	end

	private

	def events_sparql_numbers_max events
		events
			.select { |item| item['event'] == 'solutions' }
			.map do |e|
				e['sparql']['number']
			end
			.max
	end

	def show_progress_in_lodqa_bs ws, request_id, search_id
		ws.on :open do
			url = "#{ENV['LODQA_BS']}/searches/#{search_id}/subscriptions"
			Lodqa::BSClient.subscribe ws, request_id, url
		end
	end

	def register_query ws, request_id, parser_url, applicants, read_timeout, sparql_limit, answer_limit, query, target
		ws.on :open do
			Logger::Logger.request_id = request_id
			res = Lodqa::BSClient.register_query ws, request_id, query, read_timeout, sparql_limit, answer_limit, target
			next unless res

			data = JSON.parse res
			subscribe_url = data['subscribe_url']
			Lodqa::BSClient.subscribe ws, request_id, subscribe_url, 'simple'
		end
	end

	def register_pgp_and_mappings ws, target, read_timeout, sparql_limit, answer_limit, pgp, mappings, request_id
		res = Lodqa::BSClient.register_pgp_and_mappings ws, request_id, pgp, mappings, read_timeout, sparql_limit, answer_limit, target

		data = JSON.parse res
		subscribe_url = data['subscribe_url']
		Lodqa::BSClient.subscribe ws, request_id, subscribe_url, 'expert'
	end

	def start_and_sparql_count ws, target, read_timeout, sparql_limit, answer_limit, pgp, mappings, request_id
		config = dataset_config_of target

		channel = Lodqa::SourceChannel.new ws, config[:name]
		lodqa = Lodqa::Lodqa.new config[:endpoint_url],
											{ read_timeout: read_timeout&.to_i },
											config[:graph_uri],
											{
												max_hop: config[:max_hop], ignore_predicates: config[:ignore_predicates],
												sortal_predicates: config[:sortal_predicates],
												sparql_limit: sparql_limit&.to_i, answer_limit: answer_limit&.to_i
											}

		lodqa.pgp = pgp
		lodqa.mappings = mappings
		Lodqa::SparqlsCount.set_sparql_count(lodqa.sparqls.count, request_id)

		Logger::Async.defer do
			begin
				channel.start
				channel.send :sparql_count, { count: lodqa.sparqls.count }
			rescue => e
				Logger::Logger.error e, pgp: pgp, mappings: mappings
				channel.error e
			end
		end
	end

	def present_in? hash, name
		present? hash[name]
	end

	def set_query_instance_variable
		@query  = params['query'] unless params['query'].nil?
	end

	def get_targets
		response = RestClient.get settings.target_db + '/names.json'
		if response.code == 200
			(JSON.parse response).delete_if{|t| t["publicity"] == false}
		else
			raise "target db does not respond."
		end
	end

	def dataset_config_of(target)
		Lodqa::Configuration.for_target "#{settings.target_db}/#{target}.json"
	end

	def applicants_dataset(target)
		if present? target
			[dataset_config_of(target)]
		else
			Lodqa::Sources.applicants_from "#{settings.target_db}.json"
		end.map.with_index(1) { |d, n| d.merge number: n }
	end

	def sample_queries_for(applicants, params)
		applicant_queries = applicants
			.map do |a|
				a[:sample_queries].map do |sample_query|
					# Create url for a sample_query.
					uri = URI("/")
					queries = {
						query: sample_query
					}

					# Set parameters if exists
					queries[:target] = params[:target] if params[:target]
					queries[:read_timeout] = @read_timeout

					uri.query = URI.encode_www_form(queries)

					{
						url: uri.to_s,
						sample_query: sample_query
					}
				end
			end

		applicant_queries.first.zip(*applicant_queries.drop(1))
			.flatten
			.compact
			.slice(0, 15)
	end

	# The URL of parser service of natural language.
	# Get value from the `config/default-setting.json`.
	def parser_url
	  Lodqa::Configuration.default(settings.root)[:parser_url]
	end

	def present? value
		value && !value.strip.empty?
	end
end
