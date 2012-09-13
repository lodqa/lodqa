#!/opt/local/bin/ruby
require 'cgi'
require 'erb'
require 'sparql/client'
require './bioqa'


## configuration
require 'parseconfig'
config = ParseConfig.new('./bioqa.cfg')
endpoint_url = config['sparqlURL']
enju_url = config['enjuURL']
query = config['testQuery']


## query from CGI
cgi = CGI.new
query = cgi.params['query'][0]


## Parsing
qp = QueryParser.new(enju_url)
qp.parse(query)


psparql = qp.get_psparql
sparql  = qp.get_sparql


## result
#endpoint = SPARQL::Client.new(endpoint_url)
#response = endpoint.query(sparql)
#results  = '<ul>'
#response.each {|s| results += "<li><a href='#{s[:t1]}'>#{s[:l1]}</a></li>"}
#results += '</ul>'


atext = qp.get_query_with_bncs
terms = qp.get_bncs.join("\n")
sparql.gsub!('<', '&lt;')


## output
#puts psparql
tmpl_result = File.read("results.html.erb")
result = ERB.new(tmpl_result).result

print "Content-type: text/html\n\n"
print result
