#!/usr/bin/env ruby
require 'net/http'
require 'json'
require 'enju_access/enju_access'
require 'graphfinder/graphfinder'
require 'lodqa/dictionary'

module Lodqa; end unless defined? Lodqa

class Lodqa::Lodqa
  attr_reader :parse
  attr_reader :pgp
  attr_reader :terms

  def initialize(query, parser_url, dictionary_url, endpoint_url, options = {})
    parser     = EnjuAccess::CGIAccessor.new(parser_url)
    dictionary = Lodqa::Dictionary.new(dictionary_url)
    @parse     = parser.parse(query)
    @pgp       = graphicate(@parse)
    @terms     = dictionary.find_uris(@pgp[:nodes])

    @graphfinder = GraphFinder.new(endpoint_url, options[:endpoint_options] ||= {})
  end

  def find_answer(maxhop = 2)
    @terms.first.product(*terms.drop(1)) do |ts|
      @pgp[:nodes].each_with_index {|n, i| n[:term] = ts[i]}
      @graphfinder.search_graph(@pgp, maxhop)
    end
  end

  def each_solution(maxhop = 2, &block)
    @terms.first.product(*terms.drop(1)) do |ts|
      @pgp[:nodes].each_with_index {|n, i| n[:term] = ts[i]}
      @graphfinder.search_graph(@pgp, maxhop) {|s| block.call(s)}
    end
  end


  def each_solution(&block)
    @terms.first.product(*terms.drop(1)) do |ts|
      @pgp[:nodes].each_with_index {|n, i| n[:term] = ts[i]}
      @graphfinder.search_graph(@pgp, options[:maxhop]) {|s| block.call(s)}
    end
  end

  private

  def graphicate (parse)
    nodes = get_nodes(parse)
    edges = get_edges(nodes, parse)
    graph = {
      :nodes => nodes,
      :edges => edges,
      :focus => parse[:focus]
    }
  end

  def get_nodes (parse)
    variable = 't0'
    nodes = parse[:base_noun_chunks].collect do |c|
      variable = variable.next;
      {
        :id => variable,
        :head => c[:head],
        :text => parse[:tokens][c[:beg] .. c[:end]].collect{|t| t[:lex]}.join(' ')
      }
    end
  end

  def get_edges (nodes, parse)
    node_index = nodes.collect{|n| [n[:head], n[:id]]}.to_h
    edges = parse[:relations].collect do |s, p, o|
      {
        :subject => node_index[s],
        :object => node_index[o],
        :text => p.collect{|i| parse[:tokens][i][:lex]}.join(' ')
      }
    end
  end

end

if __FILE__ == $0
  # default values
  config_file = 'config/bio2rdf-mashup.cfg'
  config_file = 'config/bio2rdf-omim.cfg'
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

  lodqa = Lodqa::Lodqa.new(query, enju_url, dictionary_url, endpoint_url)
  lodqa.find_answer

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
