#!/usr/bin/env ruby
#encoding: UTF-8
require 'bundler'
Bundler.require
require './lodqa'

## configuration file processing
config         = ParseConfig.new('./lodqa.cfg')
endpoint       = config['endpointURL']
apikey         = config['apikey']
enju_url       = config['enjuURL']
ontofinder_url = config['ontofinderURL']
query          = config['testQuery']

## initialize query parser
qp = QueryParser.new(enju_url, ontofinder_url, "semanticTypes.xml")

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

post '/query' do
	query = params['query']
	qp.parse(query)
	@pasgraph = qp.get_pasgraph		# @pasgraph will be embedded in :results

	vid   = params['vid']
	@oname = params['oname']	# ontology name (acronym)
	@endpoint = endpoint
	@apikey   = apikey
	@psparql  = qp.get_psparql
	@texps    = qp.get_texps
	@turis    = qp.find_term_uris(vid)
	@sparql   = qp.get_sparql(vid, @oname)
	@atext    = qp.get_query_with_bncs
	@terms    = qp.get_bncs
	#sparql.gsub!('<', '&lt;')
	erb :results
end
