#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'sinatra-websocket'
require 'erb'
require 'lodqa'
require 'json'
require 'open-uri'
require 'cgi/util'
require "lodqa/gateway_error.rb"

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
			rescue => e
				@error_message = 'ill-formed JSON string'
			end

			params.merge!(json_params) unless json_params.nil?
		end
	end

	get '/' do
		logger.info "access"
		@config = get_config(params)
		@targets = get_targets

		@query  = params['query'] unless params['query'].nil?
		@target = params['target'] || @targets.first

		if @query
			parser_url = @config["parser_url"]
			g = Lodqa::Graphicator.new(parser_url)
			g.parse(@query)
			@parse_rendering = g.get_rendering
			@pgp = g.get_pgp
		end

		erb :index
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
		rescue GatewayError => e
			status 502
			body = e.message
		end
	end

	options '/termfinder' do
		headers \
			"Access-Control-Allow-Origin" => "*",
			"Access-Control-Allow-Headers" => "Content-Type"
	end

	# Websocket only!
	get '/solutions' do
		config = get_config(params)
		query = params['query']

		begin
			lodqa = Lodqa::Lodqa.new(config['endpoint_url'], config['graph_uri'], {:max_hop => config['max_hop'], :ignore_predicates => config['ignore_predicates'], :sortal_predicates => config['sortal_predicates']})

			request.websocket do |ws|
				proc_sparql_count = Proc.new do |sparql_count|
					ws_send(EM, ws, :sparql_count, sparql_count)
				end

				proc_anchored_pgp = Proc.new do |anchored_pgp|
					ws_send(EM, ws, :anchored_pgp, anchored_pgp)
				end

				proc_solution = Proc.new do |solution|
					ws_send(EM, ws, :solution, solution)
				end

				ws.onmessage do |data|
					json = JSON.parse(data)

					lodqa.pgp = json['pgp'].symbolize_keys
					lodqa.mappings = json['mappings']
					# lodqa.parse(query, config['parser_url'])

					EM.defer do
						ws.send("start")
						lodqa.each_anchored_pgp_and_sparql_and_solution(proc_sparql_count, proc_anchored_pgp, proc_solution)
						ws.close_connection
					end
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
		rescue OpenURI::HTTPError => e
			status 502
			body = e.message
		end
	end

	private

	def ws_send(eventMachine, websocket, key, value)
		eventMachine.add_timer(1){websocket.send({key => value}.to_json)}
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
		config = JSON.parse File.read(config_file) if File.file?(config_file)
		config = {} if config.nil?

		# target name passed through params
		unless params['target'].nil?
			target_url = settings.target_db + '/' + params['target'] + '.json'
			config_add = begin
				RestClient.get target_url do |response, request, result|
		      case response.code
		      	when 200 then JSON.parse response
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
end
