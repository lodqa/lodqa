#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'sinatra-websocket'
require 'erb'
require 'lodqa'
require 'json'

class LodqaWS < Sinatra::Base
	configure do
		set :root, File.dirname(__FILE__).gsub(/\/lib/, '')
		set :protection, :except => :frame_options
		set :server, 'thin'
		set :target_db, 'http://targets.lodqa.org/targets'

		response = RestClient.get settings.target_db + '.json'
		if response.code == 200
			set :targets, (JSON.parse response)
			set :target_names, settings.targets.map{|t| t["name"]}
		else
			raise "target db does not respond."
		end
	end

	configure :production do
		logger = Logger.new(settings.root + "/log/production.log")
		enable :logging
		logger.level = Logger::INFO
	end

	before do
		if request.content_type && request.content_type.downcase == 'application/json'
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
		erb :index
	end

	get '/graphicator' do
		config = get_config(params)
		@query = params['query']

		if @query
			parser_url = config["parser_url"]
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
		mappings = tf.find(keywords)

		headers \
			"Access-Control-Allow-Origin" => "*"
		content_type :json
		mappings.to_json
	end

	options '/termfinder' do
		headers \
			"Access-Control-Allow-Origin" => "*",
			"Access-Control-Allow-Headers" => "Content-Type"
	end

	get '/test' do
		erb :test
	end

	get '/solutions' do
		config = get_config(params)
		query = params['query']

		if !request.websocket?
			erb :solutions
		else
			request.websocket do |ws|
				proc_anchored_pgp = Proc.new do |anchored_pgp|
					ws_send(EM, ws, :anchored_pgp, anchored_pgp)
				end

				proc_sparql = Proc.new do |sparql|
					ws_send(EM, ws, :sparql, sparql)
				end

				proc_solution = Proc.new do |solution|
					ws_send(EM, ws, :solution, solution.to_h)
				end

				ws.onmessage do |data|
					begin
						json = JSON.parse(data)
						lodqa = Lodqa::Lodqa.new(config['endpoint_url'], {:max_hop => config['max_hop'], :ignore_predicates => config['ignore_predicates'], :sortal_predicates => config['sortal_predicates']})

						lodqa.pgp = json['pgp'].symbolize_keys
						lodqa.mappings = json['mappings']
						# lodqa.parse(query, config['parser_url'])

						EM.defer do
							ws.send("start")
							lodqa.each_anchored_pgp_and_sparql_and_solution(proc_anchored_pgp, proc_sparql, proc_solution)
							ws.close_connection
						end
					rescue JSON::ParserError => e
						p e.message
					end
				end
			end
		end
	end

	private

	def ws_send(eventMachine, websocket, key, value)
		eventMachine.add_timer(1){websocket.send({key => value}.to_json)}
	end

	def get_config(params)
		# default configuration
		config_file = settings.root + '/config/default-setting.json'
		config = JSON.parse File.read(config_file) if File.file?(config_file)
		config = {} if config.nil?

		# configuration file passed through params
		unless params.nil?
			unless params['config'].nil? || params['config'].empty?
				config_url = params['config']
				begin
					config_add = RestClient.get config_url do |response, request, result|
			      case response.code
			      when 200 then JSON.parse response end
		    	end
		    rescue
		    	warn "invalid url: #{params['config']}"
		    end

		    config.merge! config_add unless config_add.nil?
		  end

		  config['endpoint_url']      = params['endpoint_url']      unless params['endpoint_url'].nil?   || params['endpoint_url'].strip.empty?
		  config['graph_uri']         = params['graph_uri']         unless params['graph_uri'].nil?      || params['graph_uri'].strip.empty?
		  config['dictionary_url']    = params['dictionary_url']    unless params['dictionary_url'].nil? || params['dictionary_url'].strip.empty?
		  config['parser_url']        = params['parser_url']        unless params['parser_url'].nil?     || params['parser_url'].strip.empty?
		  config['max_hop']           = params['max_hop'].to_i      unless params['max_hop'].nil?        || params['max_hop'].strip.empty?
		  config['ignore_predicates'] = params['ignore_predicates'].split unless params['ignore_predicates'].nil? || params['ignore_predicates'].strip.empty?
		  config['sortal_predicates'] = params['sortal_predicates'].split unless params['sortal_predicates'].nil? || params['sortal_predicates'].strip.empty?
		end

	  config
	end
end
