#!/usr/bin/env ruby
#
# It takes a plain-English sentence as input and returns parsing results by accessing an Enju cgi server.
#
require 'rest-client'

module ETRIParserAccess; end unless defined? ETRIParserAccess

# An instance of this class connects to an Enju CGI server to parse a sentence.
class ETRIParserAccess::CGIAccessor
  # Noun-chunk elements
  # (Note that PRP is not included. For dialog analysis however PRP (personal pronoun) would need to be included.)
  NC_CAT      = ["NN", "NNP", "CD", "FW", "JJ"]

  # Noun-chunk elements that may appear at the head position
  NC_HEAD_CAT = ["NN", "NNP", "CD", "FW"]

  # wh-pronoun and wh-determiner
  WH_CAT      = ["WP", "WDT"]

  # It initializes an instance of RestClient::Resource to connect to an Enju cgi server
  def initialize (url)
    @server = RestClient::Resource.new url, header:{:content_type => :txt, :accept => :json}
    raise "An instance of RestClient::Resource has to be passed as the first argument." unless @server.instance_of? RestClient::Resource
  end

  # It takes a plain-English sentence as input, and
  # returns a hash that represent various aspects
  # of the PAS and syntactic structure of the sentence.
  def parse (sentence)
    apgp = get_parse(sentence)
  end

  private

  # It populates the instance variables, tokens and root
  def get_parse (sentence)
    return nil if sentence.nil? || sentence.strip.empty?
    sentence = sentence.strip
    tokens = sentence.split

    response = @server.post sentence, :content_type => :txt
    case response.code
    when 200             # 200 means success

      parse = (JSON.parse response)[0]
      bn = parse["base_noun"]
      rel = parse["relation"]

      nodes  = {}
      bn.each do |b|
        text = b["url"].split(/[\/#]/)[-1]
        next if text =~ /(무엇|누구|어디|언제)/
        nodes["t#{b["head"]}"] = {head:b["head"], uri:b["url"], text:b["url"].split(/[\/#]/)[-1]}
      end

      edges = rel.map{|r| {subject:"t#{r[0]}", object:"t#{r[2]}", text:"*"}}

      focus = nodes.keys.sort[-1]

      apgp = {nodes:nodes, edges:edges, focus:focus}
    else
      raise "ETRI parser CGI server dose not respond."
    end
  end


  # It finds base noun chunks from the category pattern.
  # It assumes that the last word of a BNC is its head.
  def get_base_noun_chunks (tokens)
    base_noun_chunks = []
    beg = -1    ## the index of the begining token of the base noun chunk
    tokens.each do |t|
      beg = t[:idx] if beg < 0 && NC_CAT.include?(t[:cat])
      beg = -1 unless NC_CAT.include?(t[:cat])
      if beg >= 0
        if t[:args] == nil && NC_HEAD_CAT.include?(t[:cat])
          base_noun_chunks << {:head => t[:idx], :beg => beg, :end => t[:idx]}
          beg = -1
        end
      end
    end
    base_noun_chunks
  end


  # It finds the shortest path between the head word of any two base noun chunks that are not interfered by other base noun chunks.
  def get_relations (tokens, base_noun_chunks)
    graph = Graph.new
    tokens.each do |t|
      if t[:args]
        t[:args].each do |type, arg|
          graph.add_edge(t[:idx], arg, 1) if arg >= 0
        end
      end
    end

    rels = []
    heads = base_noun_chunks.collect{|c| c[:head]}
    base_noun_chunks.combination(2) do |c|
      path = graph.shortest_path(c[0][:head], c[1][:head])
      s = path.shift
      o = path.pop
      rels << [s, path, o] if (path & heads).empty?
    end
    rels
  end


  # It returns the index of the "focus word."  For example, for the input
  # 
  # What devices are used to treat heart failure?
  #
  # ...it will return 1 (devides).
  def get_focus (tokens, base_noun_chunks)
    # find the wh-word
    # assumption: one query has one wh-word
    wh = -1
    tokens.each do |t|
      if WH_CAT.include?(t[:cat])
        wh = t[:idx]
        break
      end
    end

    focus = if wh > -1
              if tokens[wh][:args]
                tokens[wh][:args][0][1]
              else
                wh
              end
            elsif base_noun_chunks.nil? || base_noun_chunks.empty?
              nil
            else
              base_noun_chunks[0][:head]
            end
  end

end

# From the Ruby documentation:
# __FILE__ is the magic variable that contains the name of the current file. 
# $0 is the name of the file used to start the program. This check says “If 
# this is the main file being used…” This allows a file to be used as a 
# library, and not to execute code in that context, but if the file is 
# being used as an executable, then execute that code.

if __FILE__ == $0
  parser = ETRIParserAccess::CGIAccessor.new("http://bionlp.dbcls.jp/enju")
  parse  = parser.parse("what genes are related to alzheimer?")
  p parse
  exit
  parse[:tokens].each do |t|
    p t
  end
  puts "Root-----------------------------"
  p parse[:root]
  puts "Focus-----------------------------"
  p parse[:focus]
  puts "BNCs-----------------------------"
  p parse[:base_noun_chunks]
  puts "Heads----------------------------"
  p parse[:base_noun_chunks].collect{|c| c[:head]}
  puts "BNCs (token_begin, token_end)----"
  p parse[:base_noun_chunks].collect{|c| [c[:beg], c[:end]]}
  puts "Relations------------------------"
  p parse[:relations]
end
