#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'faye/websocket'
require 'erb'
require 'logger/async'
require 'lodqa'
require 'lodqa/one_by_one_executor'
require 'lodqa/mail_sender'
require 'lodqa/runner'
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
		set_query_instance_variable
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

	# API to recieve answers by email
	get '/query_by_e_mail' do
		raise 'Error: API key for the SendGrid is not set!' unless ENV['SENDGRID_API_KEY']

		Logger::Logger.level =  Logger::INFO
		Logger::Logger.request_id = Logger::Logger.generate_request_id

		begin
			start_time = Time.now
			answers = {}
			applicants = applicants_dataset(params[:target])
			applicants.each do | applicant |
				Logger::Async.defer do
					executor = Lodqa::OneByOneExecutor.new applicant,
																								 params['query'],
																								 parser_url: parser_url,
																								 read_timeout: 60,
																								 urilinks_url: settings.url_forwading_db

					# Bind events to gather answers
					executor.on :answer do | event, data |
						answers[data[:answer][:uri]] = data[:answer][:label]
					end

					executor.perform

					# Send email when all applicants are finished
					applicant[:finished] = true
					if applicants.all? { |a| a[:finished] }
						body = "Elapsed time: #{Time.at(Time.now - start_time).utc.strftime("%H:%M:%S")}\n\n" +
						       JSON.pretty_generate(answers.map{ | k, v | {url: k, label: v} })
						Lodqa::MailSender.send_mail params['to'], params['query'], body
					end
				end
			end

			Lodqa::MailSender.send_mail params['to'], params['query'], 'Searching the query have been starting.'
			[200, "Recieve query: #{params['query']}"]
		rescue IOError => e
			Logger::Logger.debug e, message: "Configuration Server retrun error from #{settings.target_db}.json"
			[500, "Configuration Server retrun error from #{settings.target_db}.json"]
		rescue => e
			Logger::Logger.error e
			[500, e.message]
		end
	end

	# Websocket only!
	get '/one_by_one_execute' do
		return [400, 'Please use websocket'] unless Faye::WebSocket.websocket?(env)

		# Change value to Logger::DEBUG to log for debugging.
		Logger::Logger.level =  Logger::INFO
		Logger::Logger.request_id = Logger::Logger.generate_request_id

		ws = Faye::WebSocket.new(env)
		config = get_config(params)

		# Pass the request id between threads.
		request_id = Logger::Logger.request_id
		ws.on :open do
			Logger::Logger.request_id = request_id
			begin
				applicants = applicants_dataset params[:target]
				applicants.each do | applicant |
					Logger::Async.defer do
						# Set read_timeout default 60 unless read_timeout parameter.
						# Because value of params will be empty string when it is not set and ''.to_i returns 0.
						read_timeout = params['read_timeout'].empty? ? 60 : params['read_timeout'].to_i
						executor = Lodqa::OneByOneExecutor.new applicant,
																									 params['query'],
																									 parser_url: config[:parser_url],
																									 read_timeout: read_timeout,
																									 urilinks_url: settings.url_forwading_db
						# Prepare to cancel
						ws.on :close do
							Logger::Logger.debug 'The WebSocket connection is closed.'
							executor.cancel_flag = true
						end

						# Bind events to send messsage on the WebSocket
						executor.on :datasets, :pgp, :mappings, :sparql, :query_sparql, :solutions, :answer, :gateway_error do | event, data |
							ws.send({event: event}.merge(data).to_json)
						end

						executor.perform

						# Close the web socket when all applicants are finished
						applicant[:finished] = true
						ws.close if applicants.all? { |a| a[:finished] }
					end
				end
			rescue IOError => e
				Logger::Logger.debug e, message: "Configuration Server retrun error from #{settings.target_db}.json"
				ws.close
			rescue => e
				Logger::Logger.error e
			end
		end

		return ws.rack_response
	end

	get '/solutions' do
		return [400, 'Please use websocket'] unless Faye::WebSocket.websocket?(env)
		return [400, 'target parameter is required'] unless present_in? params, :target

		# Change value to Logger::DEBUG to log for debugging.
		Logger::Logger.level = Logger::INFO
		config = dataset_config_of params[:target]

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
