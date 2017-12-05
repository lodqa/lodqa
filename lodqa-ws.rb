#!/usr/bin/env ruby
require 'sinatra/base'
require 'sinatra/async'
require 'rest_client'
require 'sinatra-websocket'
require 'erb'
require 'lodqa'
require 'json'
require 'open-uri'
require 'cgi/util'

class LodqaWS < Sinatra::Base
	register Sinatra::Async

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

	get '/template.json' do
		begin
			# debug = true # to log for debugging.
			debug = false

			Lodqa::Logger.level = debug ? :debug : :info
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

	aget '/answer' do
		begin
			debug = false # Change true to output debug log.

			Lodqa::Logger.level = debug ? :debug : :info
			parse_params

			@pgp = Lodqa::PGPFactory.create @config[:parser_url], params['query']
			if @pgp[:nodes].keys.length == 0
				@message = 'The pgp has no nodes!'
				return erb :error_before_answer
			end

			# Show result
			show_result = -> (candidate_datasets) do
				# Show error message if there is no valid dataset.
				if candidate_datasets.empty?
					@message = if target_exists?
						"<strong>#{@config[:name]}</strong> is not an enough database for the query!"
					else
						'There is no db which has all words in the query!'
					end
					return body erb :error_before_answer
				end

				# Show answers
				begin
					# Find terms of nodes and edges.
					using_dataset = candidate_datasets.first
					tf = Lodqa::TermFinder.new(using_dataset[:dictionary_url])
					keywords = @pgp[:nodes].values.map{|n| n[:text]}.concat(@pgp[:edges].map{|e| e[:text]})

					# Set parameters for seaching answers
					@mappings = tf.find(keywords)

					# Set parameters for finding label of answers
					@endpoint_url = using_dataset[:endpoint_url]
					@need_proxy = ['biogateway', 'ncats-experimental'].include? using_dataset[:name]

					@candidate_datasets = candidate_datasets.map do |ds|
						tf = Lodqa::TermFinder.new(ds[:dictionary_url])
						keywords = @pgp[:nodes].values.map{|n| n[:text]}.concat(@pgp[:edges].map{|e| e[:text]})
						ds[:mappings] = tf.find(keywords)
						ds[:need_proxy] = ['biogateway', 'ncats-experimental'].include? ds[:name]
						ds
					end

					body erb(:answer)
				rescue GatewayError
					@message = 'Dictionary lookup error!'
					body erb(:error_before_answer)
				rescue => e
					Lodqa::Logger.error e, request: request.env
					response.status = 500
					body e.message
				end
			end

			# Search datasets automatically unless target parametrs.
			read_timeout = params['read_timeout'].to_i
			if target_exists?
				Lodqa::Sources.searchable?(@pgp, [@config], read_timeout) { |dbs| show_result.call dbs }
			else
				Lodqa::Sources.select_db_for(@pgp, settings.target_db + '.json', read_timeout) { |dbs| show_result.call dbs  }
			end
		rescue => e
			Lodqa::Logger.error e, request: request.env
			raise e
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
		debug = false # Change true to output debug log.

		Lodqa::Logger.level = debug ? :debug : :info
		config = get_config(params)

		begin
			request.websocket do |ws|
				Lodqa::Runner.start(
					ws,
					name: config[:name],
					endpoint_url: config[:endpoint_url],
					graph_uri: config[:graph_uri],
					max_hop: config[:max_hop],
					ignore_predicates: config[:ignore_predicates],
					sortal_predicates: config[:sortal_predicates],
					debug: debug,
					endpoint_options: {read_timeout: params['read_timeout'].to_i || 60}
				)
			end
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

	def target_exists?
		!params['target'].nil? && !params['target'].empty?
	end

	def parse_params
		@config = get_config(params)
		@read_timeout = params['read_timeout'] || 5
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
		if target_exists?
			target_url = settings.target_db + '/' + params['target'] + '.json'
			config_add = Lodqa::Configuration.for_target target_url
			config.merge! config_add unless config_add.nil?
		end

	  config['dictionary_url'] = params['dictionary_url'] unless params['dictionary_url'].nil? || params['dictionary_url'].strip.empty?
	  config
	end
end
