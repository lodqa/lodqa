#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'faye/websocket'
require 'erb'
require 'lodqa'
require 'lodqa/one_by_one_executor'
require 'json'
require 'open-uri'
require 'cgi/util'
require 'uri'

class LodqaWS < Sinatra::Base
	configure do
		set :root, File.dirname(__FILE__).gsub(/\/lib/, '')
		set :protection, :except => :frame_options
		set :server, 'thin'
		set :target_db, 'http://targets.lodqa.org/targets'
		# set :target_db, 'http://localhost:3000/targets'
		set :url_forwading_db, 'http://urilinks.lodqa.org'

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
			parse_params

			applicants = applicants_dataset(params)
			@sample_queries = sample_queries_for applicants, params

			erb :index
		rescue Lodqa::SourceError
			[503, 'Failed to connect the Target Database.']
		end
	end

	post '/template.json' do
		begin
			# Change value to Logger::DEBUG to log for debugging.
			Lodqa::Logger.level = Logger::INFO

			parse_params

			string = params['string']
			language = params['language'] || 'en'

			raise ArgumentError, "The parameter 'string' is missing." unless string
			raise ArgumentError, "Currently only queries in English is accepted." unless language == 'en'

			template = Lodqa::Graphicator.new(@config[:parser_url]).parse(string).template

			headers 'Content-Type' => 'application/json'
			body template.to_json
		end
	end

	get '/answer' do
		parse_params
		@target = params['target'] if target_exists? params

		applicants = applicants_dataset(params)
		if applicants.length > 0
			erb :answer
		else
			response.status = 404
			body 'No dataset found'
		end
	end

	get '/grapheditor' do
		logger.info "access /grapheditor"
		parse_params

		# Set a parameter of candidates of the target
		@targets = get_targets

		# Set a parameter of the target
		@target = params['target'] || @targets.first
		@endpoint_url = @config[:endpoint_url]
		@need_proxy = @target == 'biogateway'

		if @query
			@pgp = Lodqa::PGPFactory.create @config[:parser_url], params['query']
		end

		erb :grapheditor
	end

	# Command for test: curl -H "content-type:application/json" -d '{"keywords":["drug", "genes"]} http://localhost:9292/termfinder'
	post '/termfinder' do
		config = get_config(params)

		tf = Lodqa::TermFinder.new(config['dictionary_url'])

		keywords = params['keywords']
		begin
			mappings = tf.find(keywords)

			headers \
				"Access-Control-Allow-Origin" => "*"
			content_type :json
			mappings.to_json
		rescue Lodqa::TermFindError
			status 502
		end
	end

	options '/termfinder' do
		headers \
			"Access-Control-Allow-Origin" => "*",
			"Access-Control-Allow-Headers" => "Content-Type"
	end

	# Websocket only!
	get '/one_by_one_execute' do
		return [400, 'Please use websocket'] unless Faye::WebSocket.websocket?(env)

		# Change value to Logger::DEBUG to log for debugging.
		Lodqa::Logger.level =  Logger::INFO
		Lodqa::Logger.request_id = Lodqa::Logger.generate_request_id

		begin
			ws = Faye::WebSocket.new(env)
			config = get_config(params)

			ws.on :open do
				begin
					applicants = applicants_dataset(params)
					applicants.each do | applicant |
						Lodqa::Async.defer do
							Lodqa::OneByOneExecutor.search_query ws, applicant, config[:parser_url], params['query'], params['read_timeout']&.to_i, settings.url_forwading_db

							# Close the web socket when all applicants are finished
							applicant[:finished] = true
							ws.close if applicants.all? { |a| a[:finished] }
						end
					end
				rescue IOError => e
					Lodqa::Logger.debug e, message: "Configuration Server retrun error from #{settings.target_db}.json"
					ws.close
				rescue => e
					Lodqa::Logger.error e
				end
			end
		end

		return ws.rack_response
	end

	get '/solutions' do
		return [400, 'Please use websocket'] unless Faye::WebSocket.websocket?(env)

		# Change value to Logger::DEBUG to log for debugging.
		Lodqa::Logger.level = Logger::INFO
		config = get_config(params)

		begin
			ws = Faye::WebSocket.new(env)
			Lodqa::Runner.start(
				ws,
				name: config[:name],
				endpoint_url: config[:endpoint_url],
				graph_uri: config[:graph_uri],
				endpoint_options: {
					read_timeout: params['read_timeout']&.to_i
				},
				graph_finder_options: {
					max_hop: config[:max_hop],
					ignore_predicates: config[:ignore_predicates],
					sortal_predicates: config[:sortal_predicates],
					sparql_limit: params['sparql_limit']&.to_i,
					answer_limit: params['answer_limit']&.to_i
				}
			)

			ws.rack_response
		rescue SPARQL::Client::ServerError => e
			[502, "SPARQL endpoint does not respond."]
		rescue JSON::ParserError => e
			[500, "Invalid JSON object from the client."]
		rescue => e
			Lodqa::Logger.error e, request: request.env
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

	def target_exists?(params)
		!params['target'].nil? && !params['target'].empty?
	end

	def parse_params
		@config = get_config(params)
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

	def get_config(params)
		# default configuration
		config = Lodqa::Configuration.default(settings.root)

		# target name passed through params
		if target_exists? params
			target_url = settings.target_db + '/' + params['target'] + '.json'
			config_add = Lodqa::Configuration.for_target target_url
			config.merge! config_add unless config_add.nil?
		end

	  config['dictionary_url'] = params['dictionary_url'] unless params['dictionary_url'].nil? || params['dictionary_url'].strip.empty?
	  config
	end

	def applicants_dataset(params)
		if target_exists? params
			[get_config(params)]
		else
			Lodqa::Sources.applicants_from "#{settings.target_db}.json"
		end
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
end
