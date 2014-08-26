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

  #  generate pesudo graph pattern
  def gen_pgp (query, maxhop = 2)
    # puts "[Input Query] #{query}"
    parse = @enju.parse(query)
    graph = @graphicator.graphicate(parse)
  end

  def consult_ep(graph)
    # lexicalize
    terms = @graphicator.find_uris(graph[:nodes])
    terms.first.product(*terms.drop(1)) do |ts|
      graph[:nodes].each_with_index {|n, i| n[:term] = ts[i]}
      @graphfinder.search_graph(graph, maxhop)
    end
  end

  # It generates a SVG expression that shows the predicate-argument
  # structure of the sentence
  def get_graph_rendering (parse)
    tokens = parse[:tokens]
    root   = parse[:root]
    focus  = parse[:focus]

    g = GraphViz.new(:G, :type => :digraph)
    g.node[:shape] = "box"
    g.node[:fontsize] = 11
    g.edge[:fontsize] = 9

    n = []
    tokens.each do |p|
      n[p[:idx]] = g.add_nodes(p[:idx].to_s, :label => "#{p[:lex]}/#{p[:pos]}/#{p[:cat]}")
    end

    tokens.each do |p|
      if p[:args]
        p[:args].each do |type, arg|
          if arg >= 0 then g.add_edges(n[p[:idx]], n[arg], :label => type) end
        end
      end
    end

    g.get_node(root.to_s).set {|_n| _n.color = "blue"} if root >= 0
    g.get_node(focus.to_s).set {|_n| _n.color = "red"} if focus >= 0

    graph_rendering = g.output(:svg => String)
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
