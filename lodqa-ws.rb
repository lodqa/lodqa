#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'sinatra-websocket'
require 'erb'
require 'lodqa'
require 'json'
require 'open-uri'
require 'cgi/util'

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

	post '/template.json' do
		begin
			# debug = true # to log for debugging.
			debug = false

			Lodqa::Logger.level = debug ? Logger::DEBUG : Logger::INFO
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

		applicants = applicants_dataset(params)
		if applicants.length > 0
			erb :answer
		else
			response.status = 404
			body 'No dataset found'
		end
	end

	get '/answer3' do
		return [400, 'Please use websocket'] unless request.websocket?

		Lodqa::Logger.level =  Logger::INFO
		Lodqa::Logger.request_id = Lodqa::Logger.generate_request_id

		request.websocket do |ws|
			config = get_config(params)

			ws.onopen do
				begin
					applicants = applicants_dataset(params)
					applicants.each do | applicant |
						Lodqa::Async.defer do
							search_query ws, applicant, config[:parser_url], params['query'], params['read_timeout'].to_i

              # Close the web socket when all applicants are finished
							applicant[:finished] = true
							ws.close_connection(true) if applicants.all? { |a| a[:finished] }
						end
					end
				rescue IOError => e
					Lodqa::Logger.debug e, message: "Configuration Server retrun error from #{settings.target_db}.json"
					ws.close_connection
				rescue => e
					Lodqa::Logger.error e
				end
			end
		end
	end

	def applicants_dataset(params)
		if target_exists? params
			[get_config(params)]
		else
			Lodqa::Sources.applicants_from "#{settings.target_db}.json"
		end
	end

	def search_query(ws, applicant, default_parse_url, query, read_timeout = 60)
		begin
      # Prepare to cancel
			request_id = Lodqa::Logger.request_id
			cancel_flag = false
			ws.onclose do
				Lodqa::Logger.request_id = request_id
				Lodqa::Logger.debug 'The WebSocket connection is closed.'
				cancel_flag = true
			end

			ws.send({event: :datasets, dataset: applicant[:name]}.to_json)

			# pgp
			pgp = pgp(applicant[:parser_url] || default_parse_url, params['query'])
			ws.send({event: :pgp, dataset: applicant[:name], pgp: pgp}.to_json)

			# mappings
			mappings = mappings(applicant[:dictionary_url], pgp)
			ws.send({event: :mappings, dataset: applicant[:name], pgp: pgp, mappings: mappings}.to_json)

			#Lodqa(anchored_pgp)
			options = {
				max_hop: applicant[:max_hop],
				ignore_predicates: applicant[:ignore_predicates],
				sortal_predicates: applicant[:sortal_predicates],
				debug: false,
				endpoint_options: {read_timeout: read_timeout}
			}
			lodqa = Lodqa::Lodqa.new(applicant[:endpoint_url], applicant[:graph_uri], options)
			lodqa.pgp = pgp
			lodqa.mappings = mappings

			endpoint = Lodqa::CachedSparqlClient.new(applicant[:endpoint_url], method: :get, read_timeout: read_timeout)
			lodqa.anchored_pgps.each do |anchored_pgp|
				if cancel_flag
					Lodqa::Logger.debug "Stop during processing an anchored_pgp: #{anchored_pgp}"
					return
				end

				#GraphFinder(bgb)
				graph_finder = GraphFinder.new(anchored_pgp, endpoint, nil, options)
				bgps = graph_finder.bgps

				if bgps.any?
					#SPARQL
					bgps.each do |bgp|
						if cancel_flag
							Lodqa::Logger.debug "Stop during processing an bgp: #{bgp}"
							return
						end

						ws.send({event: :bgp, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp}.to_json)

						query = {bgp: bgp, sparql: graph_finder.compose_sparql(bgp, anchored_pgp)}
						ws.send({event: :sparql, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query}.to_json)

						# Get solutions of SPARQL
						begin
							solutions = endpoint.query(query[:sparql]).map{ |solution| solution.to_h }
							ws.send({event: :solutions, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: solutions}.to_json)

							# Find the answer of the solutions.
							solutions.each do |solution|
								solution.each do |node|
									# The answer is instance node of focus node.
									if(anchored_pgp[:focus] == node[0].to_s.gsub(/^i/, ''))
										label = label(endpoint, node)
										ws.send({event: :answer, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: solutions, solution: solution, answer: node, label: label}.to_json)
									end
								end
							end

						rescue Lodqa::SparqlEndpointTimeoutError => e
							Lodqa::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a timeout error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
							ws.send({event: :solutions, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: [], error: 'sparql timeout error'}.to_json)
						rescue Lodqa::SparqlEndpointTemporaryError => e
							Lodqa::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a temporary error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
							ws.send({event: :solutions, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: [], errer: 'endopoint temporary error'}.to_json)
						end
					end
				end
			end
		rescue Lodqa::SparqlEndpointError => e
			Lodqa::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} has a persistent error, continue to the next Endpoint", error_message: e.message
		rescue Lodqa::TermFindError => e
			Lodqa::Logger.debug e.message
		rescue => e
			Lodqa::Logger.error e
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
	get '/solutions' do
		debug = false # Change true to output debug log.

		Lodqa::Logger.level = debug ? Logger::DEBUG : Logger::INFO
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

	def target_exists?(params)
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
		if target_exists? params
			target_url = settings.target_db + '/' + params['target'] + '.json'
			config_add = Lodqa::Configuration.for_target target_url
			config.merge! config_add unless config_add.nil?
		end

	  config['dictionary_url'] = params['dictionary_url'] unless params['dictionary_url'].nil? || params['dictionary_url'].strip.empty?
	  config
	end

	def pgp(parser_url, query)
		Lodqa::PGPFactory.create parser_url, query
	end

	def mappings(dictionary_url, pgp)
		tf = Lodqa::TermFinder.new(dictionary_url)
		keywords = pgp[:nodes].values.map{|n| n[:text]}.concat(pgp[:edges].map{|e| e[:text]})
		tf.find(keywords)
	end

	def label(endpoint, node)
		query_for_solution = "select ?label where { <#{node[1]}>  rdfs:label ?label }"
		endpoint.query(query_for_solution).map{ |s| s.to_h[:label] }.first
	end
end
