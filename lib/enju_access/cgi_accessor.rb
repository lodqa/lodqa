#!/usr/bin/env ruby
#
# It takes a plain-English sentence as input and returns parsing results by accessing an Enju cgi server.
#
require 'rest-client'
require 'enju_access/graph'

module EnjuAccess; end unless defined? EnjuAccess

# An instance of this class connects to an Enju CGI server to parse a sentence.
class EnjuAccess::CGIAccessor
  attr_reader :enju

  # Noun-chunk elements
  # (Note that PRP is not included. For dialog analysis however PRP (personal pronoun) would need to be included.)
  NC_CAT      = ["NN", "NNP", "CD", "FW", "JJ"]

  # Noun-chunk elements that may appear at the head position
  NC_HEAD_CAT = ["NN", "NNP", "CD", "FW"]

  # wh-pronoun and wh-determiner
  WH_CAT      = ["WP", "WDT"]

  # It initializes an instance of RestClient::Resource to connect to an Enju cgi server
  def initialize (enju_url)
    @enju = RestClient::Resource.new enju_url
    raise "The URL of a web service of enju has to be passed as the first argument." unless @enju.instance_of? RestClient::Resource
  end

  # It takes a plain-English sentence as input, and
  # returns a hash that represent various aspects
  # of the PAS and syntactic structure of the sentence.
  def parse (sentence)
    tokens, root     = get_parse(sentence)
    base_noun_chunks = get_base_noun_chunks(tokens)
    focus            = get_focus(tokens, base_noun_chunks)
    relations        = get_relations(tokens, base_noun_chunks)

    {
      :tokens => tokens,  # The array of token parses
      :root   => root,    # The index of the root word
      :focus  => focus,   # The index of the focus word, i.e., the one modified by a _wh_-modifier
      :base_noun_chunks => base_noun_chunks, # the array of base noun chunks
      :relations => relations   # Shortest paths between two heads
    }
  end

  private

  # It populates the instance variables, tokens and root
  def get_parse (sentence)
    return [[], nil] if sentence.nil? || sentence.strip.empty?
    sentence = sentence.strip

    response = @enju.get :params => {:sentence=>sentence, :format=>'conll'}
    case response.code
    when 200             # 200 means success
      raise "Empty input." if response.body =~/^Empty line/

      tokens = []

      # response is a parsing result in CONLL format.
      response.body.split(/\r?\n/).each_with_index do |t, i|  # for each token analysis
        dat = t.split(/\t/, 7)
        token = Hash.new
        token[:idx]  = i - 1   # use 0-oriented index
        token[:lex]  = dat[1]
        token[:base] = dat[2]
        token[:pos]  = dat[3]
        token[:cat]  = dat[4]
        token[:type] = dat[5]
        token[:args] = dat[6].split.collect{|a| type, ref = a.split(':'); [type, ref.to_i - 1]} if dat[6]
        tokens << token  # '<<' is push operation
      end

      root = tokens.shift[:args][0][1]

      # get span offsets
      i = 0
      tokens.each do |t|
        i += 1 until sentence[i] !~ /[ \t\n]/
        t[:beg] = i
        t[:end] = i + t[:lex].length
        i = t[:end]
      end

      [tokens, root]
    else
      raise "Enju CGI server dose not respond."
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
  # ...it will return 1 (devices).
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
              0
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
  parser = EnjuAccess::CGIAccessor.new("http://bionlp.dbcls.jp/enju")
  parse  = parser.parse("what genes are related to alzheimer?")
  # p parse
  # exit
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
