#!/usr/bin/env ruby
#
# It takes a plain-English sentence as input and returns parsing results by accessing an Enju cgi server.
#
require 'rest-client'
require 'graphviz'
require_relative './graph'

# An instance of this class holds the parsing result of a natural language query as anlyzed by Enju.
class EnjuAccessor
  # The array of token parses
  attr_reader :tokens
  # The index of the root word
  attr_reader :root
  # The index of the focus word, i.e., the one modified by a _wh_-modifier
  attr_reader :focus
  # The index of the noun chunk heads
  attr_reader :heads
  # Token-index of base noun chunks: head -> pair, (offset of the beginning token, offset of the ending token)
  attr_reader :token_index_bncs
  # Caret-index of base noun chunks: head -> pair, (offset of the caret before the first character, offset of the caret after the last character)
  attr_reader :caret_index_bncs
  # Shortest paths between two heads
  attr_reader :rels
  # A graphical rendering of the graph of predicate-argument relations
  attr_reader :graph_rendering

  # Noun-chunk elements
  #
  # (Note that PRP is not included. For dialog analysis however PRP (personal pronoun) would need to be included.)
  NC_CAT      = ["NN", "NNP", "CD", "FW", "JJ"]

  # Noun-chunk elements that may appear at the head position
  NC_HEAD_CAT = ["NN", "NNP", "CD", "FW"]

  # wh-pronoun and wh-determiner
  WH_CAT      = ["WP", "WDT"]

  # It initializes an instance of RestClient::Resource to connect to an Enju cgi server
  def initialize (enju_url)
    @enju = RestClient::Resource.new enju_url
    raise "An instance of RestClient::Resource has to be passed as the first argument." unless enju.instance_of? RestClient::Resource
  end

  # It takes a plain-English sentence as input,
  # creates an instance of EnjuParse, and
  # populates various attributes that represent various aspects
  # of the PAS and syntactic structure of the sentence.
  def parse (sentence)
    tokens, root = get_parse(sentence)
    base_noun_chunks = get_base_noun_chunks(tokens)
    focus = get_focus(tokens, base_noun_chunks)
    graph_rendering = get_graph(tokens, root)
    get_rels
  end

  private

  # It populates the instance variables, tokens and root
  def get_parse (sentence)
    return [] if sentence.nil? || sentence.empty?

    response = @enju.get :params => {:sentence=>sentence, :format=>'conll'}
    case response.code
    when 200             # 200 means success
      raise "Empty input." if response =~/^Empty line/

      tokens = []

      # response is a parsing result in CONLL format.
      response.split(/\r?\n/).each_with_index do |t, i|  # for each token analysis
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

      root = @tokens.shift[:args][0][1]

      # get span offsets
      i = 0
      tokens.each do |p|
        i += 1 until sentence[i] !~ /[ \t\n]/
        p[:beg] = i
        p[:end] = i + p[:lex].length
        i = p[:end]
      end

      tokens, root
    else
      raise "Enju CGI server dose not respond."
    end
  end


  # It populates @heads which holds an array of noun chunk heads (word index)
  # So, for the input 
  #
  # Show me devices used to treat heart failure
  #
  # ...it will return
  #
  # 2, 7

  # returns a hash of word indices to arrays of begining and ending indices.
  # It maps from a word's index to the slice of the array that contains that
  # word within a base noun chunk. 
  # Assumption: last word of the BNC is the head.
  def get_base_noun_chunks (tokens)
    base_noun_chunks = []
    beg = -1    ## the index of the begining token of the base noun chunk
    tokens.each do |t|
      beg = t[:idx] if beg < 0 if NC_CAT.include?(t[:cat])
      if beg >= 0
        if t[:args] == nil && NC_HEAD_CAT.include?(t[:cat])
          base_noun_chunks << {:head => t[:idx], :beg => beg, :end => t[:idx]}
        end
        beg = -1
      end
    end
    base_noun_chunks
  end


  # generates a graphics file that shows the predicate-argument 
  # structure of the sentence
  def get_graph (tokens, root, focus)
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


  # returns an array of...subject, shortest path, and object indices.
  def get_rels
    graph = Graph.new
    @tokens.each do |p|
      if p[:args]
        p[:args].each do |type, arg|
          graph.add_edge(p[:idx], arg, 1) if arg >= 0
        end
      end
    end

    @rels = []
    @heads.each_with_index do |h1, i|
      @heads[i+1..-1].each do |h2|
        path = graph.shortest_path(h1, h2)
        s = path.shift
        o = path.pop
        @rels << [s, path, o] if (path & @heads).empty?
      end
    end
  end


  # returns the index of the "focus word."  For example, for the input
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

    focus =
      if wh > -1
        if tokens[wh][:args]
          tokens[wh][:args][0][1]
        else
          wh
        end
      elsif !base_noun_chunks.nil? && !base_noun_chunks.empty?
        base_noun_chunks[0][:head]
      else
        nil
      end
  end

  # Returns a word based on the index into the PAS.
  # For single words, as opposed to arrays--see below for arrays.
  def idx_get_word(i)
    @tokens[i][:lex]
  end

  # From an array of word indices, return an array of words.
  # For arrays, as opposed to single words--see above for single words.
  # The parameter v is a path.  Random walk.
  #
  # Called by lodqa.rb.
  def idxv_get_word(v)
    v.collect {|x| @tokens[x][:lex]}
  end

  # Input: a pair of beginning and ending indices.
  # This basically does a sequential walk through the words that appear
  # sequentially in the input sentence.
  def idxs_get_words(s)
    words = []
    unless s == nil
      (s[0]..s[1]).each do |i|
        words.push @tokens[i][:lex]
      end
    end
    words
  end

end

# From the Ruby documentation:
# __FILE__ is the magic variable that contains the name of the current file. 
# $0 is the name of the file used to start the program. This check says “If 
# this is the main file being used…” This allows a file to be used as a 
# library, and not to execute code in that context, but if the file is 
# being used as an executable, then execute that code.

if __FILE__ == $0
  enju_accessor = RestClient::Resource.new "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"

  offset = 0
  ARGF.each do |line|
    parse = EnjuParse.new(enju_accessor, line.chomp)
    parse.tokens.each do |p|
      p p
    end
    puts "Root-----------------------------"
    p parse.root
    puts "Heads----------------------------"
    p parse.heads
    puts "BNCs (token_begin, token_end)----"
    p parse.token_index_bncs
    puts "BNCs (caret_begin, caret_end)----"
    p parse.caret_index_bncs
    puts "Relations------------------------"
    p parse.rels
  end
end
