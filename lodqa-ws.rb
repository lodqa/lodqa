#!/usr/bin/env ruby
require 'bundler'
Bundler.require
require_relative 'lodqa'
require_relative 'annotation'

## configuration file processing
config         = ParseConfig.new('lodqa.cfg')
apikey         = config['apikey']
endpoint_url   = config['endpointURL']
graph_uri      = config['graphURI']
enju_url       = config['enjuURL']
dictionary_url = config['dictionaryURL']
query          = config['testQuery']

## initialize sparql generator
g = Lodqa.new(enju_url, dictionary_url, endpoint_url, graph_uri)

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

	@endpoint  = endpoint_url
	@apikey    = apikey
	
	p          = g.nlq2sparql(query)
	@pasgraph  = p.parse.graph_rendering		# @pasgraph will be embedded in :results
	@psparql   = p.psparql
	@term_exps = p.term_exps
	@term_uris = p.term_uris
	@sparql    = p.sparql
	@atext     = Annotation.render_text_annotation(query, p.parse.caret_index_bncs.values)
	erb :results
end
