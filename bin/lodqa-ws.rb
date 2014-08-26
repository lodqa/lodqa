#!/usr/bin/env ruby
require 'bundler'
Bundler.require

require 'enju_access/enju_access'
require 'lodqa'
require 'annotation'

## configuration file processing
config           = ParseConfig.new('config/lodqa.cfg')
endpoint_url     = config['endpointURL']
endpoint_options = config['endpointOptions']
graph_uri        = config['graphURI']
enju_url         = config['enjuURL']
dictionary_url   = config['dictionaryURL']
query            = config['testQuery']

## initialize Enju accessor
parser   = EnjuAccess::CGIAccessor(enju_url)
endpoint = SPARQL::Client.new(endpoint_url, endpoint_options)

## initialize sparql generator
g = Lodqa.new(dictionary_url, endpoint_url, enju_url)

configure do
	set :protection, :except => :frame_options
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

get '/query' do
	query = params['query']
	lodqa(query, endpoint, parser, dictionary)

	parse = parser.parse(query)
	@pasgraph = EnjuAccess::get_graph_rendering(parse)		# @pasgraph will be embedded in :results

	@endpoint  = endpoint_url
	@apikey    = apikey

	p          = g.gen_sparql(query)

    # puts JSON.pretty_generate(graph)

	@psparql   = p.psparql
	@term_exps = p.term_exps
	@term_uris = p.term_uris
	@sparql    = p.sparql
	@atext     = Annotation.render_text_annotation(query, p.parse.caret_index_bncs.values)
	erb :results
end
