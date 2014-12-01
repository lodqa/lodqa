#!/usr/bin/env ruby
require 'sinatra/base'
require 'sparql/client'
require 'sinatra-websocket'
require 'erb'
require 'lodqa'
require 'json'

class LodqaWS < Sinatra::Base
	## configuration
	require 'app_config'
	AppConfig.setup!(yaml: 'config/qald-biomed.yml')
	# AppConfig.setup!(yaml: 'config/bio2rdf-mashup.yml')
	# AppConfig.setup!(yaml: 'config/biogateway.yml')
	endpoint_url      = AppConfig.endpoint_url
	endpoint_options  = AppConfig.endpoint_options
	ignore_predicates = AppConfig.ignore_predicates
	sortal_predicates = AppConfig.sortal_predicates
	parser_url        = AppConfig.parser_url
	dictionary_url    = AppConfig.dictionary_url

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
		@query = params['query']
		lodqa = Lodqa::Lodqa.new(@query, parser_url, dictionary_url, endpoint_url, {:max_hop => 3, :debug => false, :ignore_predicates => ignore_predicates, :sortal_predicates => sortal_predicates})
		@parse_rendering = lodqa.parse_rendering
		@pgp = lodqa.pgp
		@mappings = lodqa.mappings
		erb :analysis
	end

	get '/solutions' do
		if !request.websocket?
			@query = params['query']
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

					EM.defer do
						@query = params['query']
						lodqa = Lodqa::Lodqa.new(@query, parser_url, dictionary_url, endpoint_url, {:max_hop => 3, :debug => false, :ignore_predicates => ignore_predicates, :sortal_predicates => sortal_predicates})
						parse_rendering = lodqa.get_parse_rendering
						ws.send({:parse_rendering => parse_rendering}.to_json)
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
end
