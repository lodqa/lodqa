#!/usr/bin/env ruby
require 'net/http'
require_relative 'enju_accessor'
require_relative 'graphicator'
require_relative 'graphfinder'
require 'json'

class Lodqa
  def initialize (dictionary_url, endpoint_url, enju_url)
    @enju = EnjuAccessor.new enju_url
    @graphicator = Graphicator.new dictionary_url
    @graphfinder = GraphFinder.new endpoint_url
  end

  def gen_sparql (query, maxhop = 2)
    puts "[Input Query] #{query}"


    parse = @enju.parse(query)

    graph = @graphicator.graphicate(parse)

    puts "[Pseudo Graph Pattern]"
    puts JSON.pretty_generate(graph)
    puts '====='

    # lexicalize
    terms = @graphicator.find_uris(graph[:nodes])
    terms.first.product(*terms.drop(1)) do |ts|
      graph[:nodes].each_with_index {|n, i| n[:term] = ts[i]}
      p graph
      puts "-----"
      @graphfinder.search_graph(graph, maxhop)
    end
  end
end

if __FILE__ == $0
  # default values
  config_file = '../config/bio2rdf-mashup.cfg'
  maxhop = 2

  ## command line option processing
  require 'optparse'
  optparse = OptionParser.new do |opts|
    opts.banner = "Usage: lodqa.rb [options]"

    opts.on('-c', '--configuration filename', "specifies configuration file (default = '#{config_file}')") do |f|
      config_file = f
    end

    opts.on('-m', '--maxhop number', "specifies the number of maximum hops to investigate (default = '#{maxhop}')") do |n|
      maxhop = n.to_i
    end

    opts.on('-h', '--help', 'displays this screen') do
      puts opts
      exit
    end
  end

  optparse.parse!

  ## configuration
  require 'parseconfig'
  config = ParseConfig.new(config_file)
  endpoint_url   = config['endpointURL']
  enju_url       = config['enjuURL']
  dictionary_url = config['dictionaryURL']
  query          = config['Query']
  
  ## query from the command line
  unless ARGV.empty?
    query   = ARGV[0]
  end

  puts "[SPARQL Endpoint] #{endpoint_url}"
  puts "[Maximum number of hops] #{maxhop}"

  lodqa = Lodqa.new(dictionary_url, endpoint_url, enju_url)
  p = lodqa.gen_sparql(query, maxhop)

  # p p.query_annotation
  # puts "-----"
  # puts p.psparql
  # puts "-----"
  # p p.term_uris
  # puts "-----"
  # puts p.sparql
  # puts "-----"

  # p.parse(query)
  # psparql = qp.get_psparql
  # puts psparql

  # sparql  = qp.get_sparql(vid, acronym)
  # puts sparql

  ## result
  # require 'sparql/client'
  # endpoint = SPARQL::Client.new(endpoint_url)
  # result = endpoint.query(sparql)
  # result.each {|s| puts s[:t1] + "\t" + s[:l1]}
end
