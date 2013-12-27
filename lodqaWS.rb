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

## initialize sparql generator
g = SparqlGenerator.new(enju_url, ontofinder_url, "semanticTypes.xml")

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
	query     = params['query']
	oid       = params['oid']
	@oacronym = params['oacronym']	# ontology name (acronym)

	@endpoint  = endpoint
	@apikey    = apikey
	
	p          = g.nlq2sparql(query, oid, @oacronym)
	@pasgraph  = p.pasgraph		# @pasgraph will be embedded in :results
	@psparql   = p.psparql
	@term_exps = p.term_exps
	@term_uris = p.term_uris
	@sparql    = p.sparql
	@atext     = p.query_annotation
	#sparql.gsub!('<', '&lt;')
	erb :results
end
