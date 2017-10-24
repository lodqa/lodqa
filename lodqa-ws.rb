#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'sinatra-websocket'
require 'erb'
require 'lodqa'
require 'json'
require 'open-uri'
require 'cgi/util'
require 'securerandom'
require "lodqa/gateway_error.rb"
require 'lodqa/logger'

class LodqaWS < Sinatra::Base
	configure do
		set :root, File.dirname(__FILE__).gsub(/\/lib/, '')
		set :protection, :except => :frame_options
		set :server, 'thin'
		set :target_db, 'http://targets.lodqa.org/targets'
		# set :target_db, 'http://localhost:3000/targets'

    enable :logging
    file = File.new("#{settings.root}/log/#{settings.environment}.log", 'a+')
    file.sync = true
    use Rack::CommonLogger, file
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
		logger.info "access /"
		parse_params
		erb :index
	end

	get '/answer' do
		parse_params

		@pgp = get_pgp @config[:parser_url]
		if @pgp[:nodes].keys.length == 0
			@message = 'The pgp has no nodes!'
			return erb :error_before_answer
		end

		# Search datasets automatically unless target parametrs.
		@candidate_datasets = if target_exists?
			searchable? @pgp, [{
				name: @config[:name],
				dictionary_url: @config[:dictionary_url],
				endpoint_url: @config[:endpoint_url]
			}]
		else
			select_db_for @pgp
		end

		# Show error message if there is no valid dataset.
		if @candidate_datasets.empty?
			@message = if target_exists?
				"<strong>#{@config[:name]}</strong> is not an enough database for the query!"
			else
				'There is no db which has all words in the query!'
			end
			return erb :error_before_answer
		end

		# Show answers
		begin
			# Find terms of nodes and edges.
			using_dataset = @candidate_datasets.first
			tf = Lodqa::TermFinder.new(using_dataset[:dictionary_url])
			keywords = @pgp[:nodes].values.map{|n| n[:text]}.concat(@pgp[:edges].map{|e| e[:text]})

			# Set parameters for seaching answers
			@mappings = tf.find(keywords)

			# Set parameters for finding label of answers
			@endpoint_url = using_dataset[:endpoint_url]
			@need_proxy = using_dataset[:name] == 'biogateway'

			erb :answer
		rescue GatewayError
			@message = 'Dictionary lookup error!'
			erb :error_before_answer
		end
	end

	get '/grapheditor' do
		logger.info "access /grapheditor"
		parse_params

		# Set a parameter of candidates of the target
		@targets = get_targets

		# Set a parameter of the default target
		@target = params['target'] || @targets.first

		if @query
			@pgp = get_pgp @config[:parser_url]
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
		rescue GatewayError
			status 502
		end
	end

	options '/termfinder' do
		headers \
			"Access-Control-Allow-Origin" => "*",
			"Access-Control-Allow-Headers" => "Content-Type"
	end

	# Websocket only!
	get '/solutions' do
		debug = false
		Lodqa::Logger.level = debug ? :debug : :info

		config = get_config(params)
		options = {
			max_hop: config[:max_hop],
			ignore_predicates: config[:ignore_predicates],
			sortal_predicates: config[:sortal_predicates],
			debug: debug,
			endpoint_options: {read_timeout: params['read_timeout'].to_i || 60}
		}

		begin
			lodqa = Lodqa::Lodqa.new(config[:endpoint_url], config[:graph_uri], options)

			request.websocket do |ws|
				request_id = SecureRandom.uuid

				# Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
				Lodqa::Logger.debug('Request start', request_id)

				proc_sparqls = Proc.new do |sparqls|
					ws_send(EM, ws, :sparqls, sparqls)
				end

				proc_anchored_pgp = Proc.new do |anchored_pgp|
					ws_send(EM, ws, :anchored_pgp, anchored_pgp)
				end

				proc_solution = Proc.new do |solution|
					ws_send(EM, ws, :solution, solution)
				end

				ws.onmessage do |data|
					json = JSON.parse(data, {:symbolize_names => true})

					lodqa.pgp = json[:pgp]
					lodqa.mappings = json[:mappings]

					EM.defer do
						Thread.current.thread_variable_set(:request_id, request_id)

						begin
							ws.send("start")
							lodqa.each_anchored_pgp_and_sparql_and_solution(proc_sparqls, proc_anchored_pgp, proc_solution)
						rescue => e
							Lodqa::Logger.error "error: #{e.inspect}, backtrace: #{e.backtrace}, data: #{data}"
							ws.send({error: e}.to_json)
						ensure
							ws.close_connection(true)
						end
					end
				end

				ws.onclose do
					# Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
					Lodqa::Logger.debug 'The WebSocket connection is closed.', request_id
					lodqa.dispose request_id
				end

			end
		rescue SPARQL::Client::ServerError => e
			[502, "SPARQL endpoint does not respond."]
		rescue JSON::ParserError => e
			[500, "Invalid JSON object from the client."]
		rescue => e
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

	private

	def target_exists?
		!params['target'].nil? && !params['target'].empty?
	end

	def parse_params
		@config = get_config(params)
		@read_timeout = params['read_timeout'] || 5
		@query  = params['query'] unless params['query'].nil?
	end

	def ws_send(eventMachine, websocket, key, value)
		websocket.send({key => value}.to_json)
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
		config_file = settings.root + '/config/default-setting.json'
		config = JSON.parse File.read(config_file), {:symbolize_names => true} if File.file?(config_file)
		config = {} if config.nil?

		# target name passed through params
		if target_exists?
			target_url = settings.target_db + '/' + params['target'] + '.json'
			config_add = begin
				RestClient.get target_url do |response, request, result|
					case response.code
					when 200 then JSON.parse response, {:symbolize_names => true}
					else raise IOError, "invalid target"
					end
				end
			rescue
				raise IOError, "invalid target"
			end

			config_add.delete_if{|k, v| v.nil?}
			config.merge! config_add unless config_add.nil?
		end

	  config['dictionary_url'] = params['dictionary_url'] unless params['dictionary_url'].nil? || params['dictionary_url'].strip.empty?

	  config
	end

	def get_pgp(parser_url)
		g = Lodqa::Graphicator.new(parser_url)
		g.parse(params['query'])
		g.get_pgp
	end

	def searchable?(pgp, applicants)
		keywords = pgp[:nodes].values.map{|n| n[:text]}
		applicants
			.map do |applicant|
				begin
					applicant[:terms] = Lodqa::TermFinder
						.new(applicant[:dictionary_url])
						.find(keywords)
					applicant
				rescue GatewayError
					p "dictionary_url error for #{applicant[:name]}"
					applicant
				end
			end
			.select {|applicant| applicant[:terms] && applicant[:terms].all?{|t| t[1].length > 0 } }
	end

	def select_db_for(pgp)
		targets_url = settings.target_db + '.json'

		applicants = begin
			RestClient.get targets_url do |response, request, result|
				case response.code
					when 200 then JSON.parse response
					else raise IOError, "invalid url #{targets_url}"
				end
			end
		rescue
			raise IOError, "invalid url #{targets_url}"
		end
			.map{|config| {name: config['name'], dictionary_url: config['dictionary_url'], endpoint_url: config['endpoint_url']}}

		searchable? pgp, applicants
	end
end
