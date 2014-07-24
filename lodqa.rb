#!/usr/bin/env ruby
require 'net/http'
require_relative 'query_parse'

class Lodqa
  def initialize (enju_url, dictionary_url)
    @enju_accessor       = RestClient::Resource.new enju_url
    @dictionary_accessor = RestClient::Resource.new dictionary_url, :headers => {:content_type => :json, :accept => :json}
  end

  def nlq2sparql (query, graph_uri = nil)
    sparql = QueryParse.new(query, @enju_accessor, @dictionary_accessor, graph_uri)
  end
end

if __FILE__ == $0
  # default values
  config_file = 'lodqa.cfg'

  ## command line option processing
  require 'optparse'
  optparse = OptionParser.new do |opts|
    opts.banner = "Usage: lodqa.rb [options]"

    opts.on('-c', '--configuration filename', "specifies configuration file (default = '#{config_file}')") do |f|
      config_file = f
    end
    
    opts.on('-h', '--help', 'displays this screen') do
      puts opts
      exit
    end
  end

  optparse.parse!

  ## configuration
  require 'parseconfig'
  config = ParseConfig.new('lodqa.cfg')
  endpoint_url   = config['endpointURL']
  enju_url       = config['enjuURL']
  dictionary_url = config['dictionaryURL']
  query          = config['Query']
  
  ## query from the command line
  unless ARGV.empty?
    query   = ARGV[0]
  end

  l = Lodqa.new(enju_url, dictionary_url)
  p = l.nlq2sparql(query)
  # p p.query_annotation
  # puts "-----"
  puts p.psparql
  puts "-----"
  p p.term_uris
  puts "-----"
  puts p.sparql
  puts "-----"

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
