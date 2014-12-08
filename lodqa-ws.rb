#!/usr/bin/env ruby
require 'sinatra/base'
require 'rest_client'
require 'sinatra-websocket'
require 'erb'
require 'lodqa'
require 'json'
require 'app_config'

class LodqaWS < Sinatra::Base
	configure do
		set :protection, :except => :frame_options
		set :server, 'thin'
	end

	get '/' do
		erb :index
	end

	get '/participants' do
		erb :participants
	end

	get '/references' do
		erb :references
	end

	get '/motivation' do
		erb :motivation
	end

	get '/analysis' do
		@config = get_config(params)
		@query = params['query']

		unless @config.nil? || @config['endpoint_url'].nil? || @config['endpoint_url'].empty?
			lodqa = Lodqa::Lodqa.new(@config['endpoint_url'])

			lodqa.parse(@query, @config['parser_url']) unless @config['parser_url'].nil? || @config['parser_url'].empty?
			@parse_rendering = lodqa.parse_rendering
			@pgp = lodqa.pgp

			lodqa.lookup(@config['dictionary_url']) unless @config['dictionary_url'].nil? || @config['dictionary_url'].empty?
			@mappings = lodqa.mappings
		else
			@message = 'Endpoint is not specified.'
		end

		if !@message.nil?
			@config = 'EMPTY' if @config.nil? || @config.empty?
			erb :error
		else
			erb :analysis
		end
	end

	get '/solutions' do
		config = get_config(params)
		query = params['query']

		if !request.websocket?
			erb :solutions
		else
			request.websocket do |ws|
				ws.onopen do
					proc_anchored_pgp = Proc.new do |anchored_pgp|
						ws_send(EM, ws, :anchored_pgp, anchored_pgp)
					end

					proc_sparql = Proc.new do |sparql|
						ws_send(EM, ws, :sparql, sparql)
					end

					proc_solution = Proc.new do |solution|
						ws_send(EM, ws, :solution, solution.to_h)
					end

					lodqa = Lodqa::Lodqa.new(config["endpoint_url"], {:max_hop => config["max_hop"], :ignore_predicates => config["ignore_predicates"], :sortal_predicates => config["sortal_predicates"]})

					# replace the next two lines to
					# lodqa.pgp = ...
					# lodqa.mappings = ...
					lodqa.parse(query, parser_url)
					lodqa.lookup(dictionary_url)

					EM.defer do
						ws.send("start")
						lodqa.each_anchored_pgp_and_sparql_and_solution(proc_anchored_pgp, proc_sparql, proc_solution)
						ws.close_connection
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
		config_file = 'config/qald-biomed.json'
		config = JSON.parse File.read(config_file) if File.file?(config_file)

		# configuration file passed through params
		unless params.nil?
			unless params['config'].nil? || params['config'].empty?
				begin
					config_add = RestClient.get config_url do |response, request, result|
			      case response.code
			      when 200 then JSON.parse response end
		    	end
		    rescue
		    	warn "invalid url"
		    end

		    config.merge! config_add unless config_add.nil?
		  end

		  config['endpoint_url']      = params['endpoint_url']      unless params['endpoint_url'].nil?   || params['endpoint_url'].strip.empty?
		  config['graph_uri']         = params['graph_uri']         unless params['graph_uri'].nil?      || params['graph_uri'].strip.empty?
		  config['dictionary_url']    = params['dictionary_url']    unless params['dictionary_url'].nil? || params['dictionary_url'].strip.empty?
		  config['parser_url']        = params['parser_url']        unless params['parser_url'].nil?     || params['parser_url'].strip.empty?
		  config['max_hop']           = params['max_hop']           unless params['max_hop'].nil?        || params['max_hop'].strip.empty?
		  config['ignore_predicates'] = params['ignore_predicates'].split unless params['ignore_predicates'].nil? || params['ignore_predicates'].strip.empty?
		  config['sortal_predicates'] = params['sortal_predicates'].split unless params['sortal_predicates'].nil? || params['sortal_predicates'].strip.empty?
		end

	  config
	end
end
