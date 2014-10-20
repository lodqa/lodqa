#!/usr/bin/env ruby
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

	get '/solutions' do
		if !request.websocket?
			@query = params['query']
			erb :solutions
		else
			request.websocket do |ws|
				ws.onopen do
					ws.send("start")
					EM.defer do
						@query = "what side effects are associated with streptomycin?"
						lodqa = Lodqa::Lodqa.new(@query, parser_url, dictionary_url, endpoint_url, {:debug => false, :ignore_predicates => ignore_predicates, :sortal_predicates => sortal_predicates})

						proc_anchored_pgp = Proc.new do |anchored_pgp|
							EM.add_timer(1){ws.send({:anchored_pgp => anchored_pgp}.to_json)}
						end

						proc_solution = Proc.new do |solution|
							EM.add_timer(1){ws.send({:solution => solution.to_h}.to_json)}
						end

						lodqa.each_anchored_pgp_and_solution(proc_anchored_pgp, proc_solution)

						ws.close_connection
					end
				end
			end
		end
	end
end
