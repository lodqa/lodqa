#!/usr/bin/env ruby
# encoding: UTF-8
#
# It takes a plain-English sentence as input and returns parsing results by accessing an Enju cgi server.
#
Encoding.default_external="UTF-8"
Encoding.default_internal="UTF-8"
require 'rest-client'
require 'htmlentities'
require 'graphviz'
require 'diff/lcs'
require 'diff/lcs/string'
require_relative './graph'

# An instance of this class holds the parsing result
# of a natural language query by Enju
# tparses : array of token parses
# root    : the index of the root word
# focus   : the index of the focus word
# heads   : the index of the noun chunk heads
# bnc_span_word_index  : word span : (offset of the beginning word, off set of the ending word)
# bnc_span_caret_index : caret span : (offset of the caret before the first character, offset of the caret after the last character)
class EnjuParse
  attr_reader :tparses, :root, :focus, :heads, :bnc_span_word_index, :bnc_span_caret_index, :rels, :graph, :graph_rendering

  # noun-chunk elements
  # Note that PRP is removed here. For dialog analysis however PRP would need to be included.
  NC_CAT      = ["NN", "NNP", "CD", "FW", "JJ"]
  NC_HEAD_CAT = ["NN", "NNP", "CD", "FW"]

  # wh-
  WH_CAT = ["WP", "WDT"]

  # This initializer takes an instance of 
  # RestClient::Resource to connect to an Enju cgi server
  # and a plain-English sentence as input.
  # Populates a bunch of instance variables that represent various aspects
  # of the PAS and syntactic structure of the sentence.
  def initialize (enju_accessor, sentence)
    @sentence = sentence

    get_tparses(enju_accessor, sentence)
    get_heads
    get_bnc_span_index
    get_focus
    get_graph
    get_rels
  end

  # It populates the instance variables, tparses and root
  def get_tparses (enju_accessor, sentence)
    raise "An instance of RestClient::Resource has to be passed for the first argument." unless enju_accessor.instance_of? RestClient::Resource

    response = enju_accessor.get :params => {:sentence=>@sentence, :format=>'conll'}
    case response.code
    when 200             # 200 means success
      raise "Empty input." if response =~/^Empty line/

      @tparses = []

      # response is a parsing result in CONLL format.
      response.split(/\r?\n/).each_with_index do |t, i|  # for each token analysis
        dat = t.split(/\t/, 7)
        tparse = Hash.new
        tparse[:idx]  = i - 1   # use 0-oriented index
        tparse[:word] = dat[1]
        tparse[:base] = dat[2]
        tparse[:pos]  = dat[3]
        tparse[:cat]  = dat[4]
        tparse[:type] = dat[5]
        tparse[:args] = dat[6].split.collect{|a| type, ref = a.split(':'); [type, ref.to_i - 1]} if dat[6]
        @tparses << tparse  # '<<' is push operation
      end

      @root = @tparses.shift[:args][0][1]

      # get span offsets
      i = 0
      @tparses.each do |p|
        i += 1 until sentence[i] !~ /[ \t\n]/
        p[:beg] = i
        p[:end] = i + p[:word].length
        i = p[:end]
      end
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
  def get_heads
    @heads = []
    @tparses.each do |p|
      @heads << p[:idx] if p[:args] == nil and NC_HEAD_CAT.include?(p[:cat])
    end

    @heads.delete_if {|h| @tparses[h][:word] == 'me'}
  end


  # returns a hash of word indices to arrays of begining and ending indices.
  # It maps from a word's index to the slice of the array that contains that
  # word within a base noun chunk. 
  # Assumption: last word of the BNC is the head.
  def get_bnc_span_index
    @bnc_span_word_index = {}       
    @bnc_span_caret_index = {}      
    beg, lidx, lcat = -1, -1, ''    ## begining word index, last word index, last category
    @tparses.each do |p|
      if NC_CAT.include?(p[:cat])
        beg = p[:idx] if beg < 0
      else
        if beg >= 0
          if NC_HEAD_CAT.include?(lcat) and @heads.include?(lidx)
            @bnc_span_word_index[lidx]  = [beg, lidx]
            @bnc_span_caret_index[lidx] = [@tparses[beg][:beg], @tparses[lidx][:end]]
          end
          beg = -1
        end
      end

      lidx, lcat = p[:idx], p[:cat]
    end

    if (beg >= 0) and NC_HEAD_CAT.include?(lcat) and @heads.include?(lidx)
        @bnc_span_word_index[lidx]  = [beg, lidx]
        @bnc_span_caret_index[lidx] = [@tparses[beg][:beg], @tparses[lidx][:end]]
    end
  end


  # generates a graphics file that shows the predicate-argument 
  # structure of the sentence
  def get_graph
    @graph = Graph.new
    @tparses.each do |p|
      if p[:args]
        p[:args].each do |type, arg|
          @graph.add_edge(p[:idx], arg, 1) if arg >= 0
        end
      end
    end

    g = GraphViz.new(:G, :type => :digraph)
    g.node[:shape] = "box"
    g.node[:fontsize] = 11
    g.edge[:fontsize] = 9

    n = []
    @tparses.each do |p|
      n[p[:idx]] = g.add_nodes(p[:idx].to_s, :label => "#{p[:word]}/#{p[:pos]}/#{p[:cat]}")
    end

    @tparses.each do |p|
      if p[:args]
        p[:args].each do |type, arg|
          if arg >= 0 then g.add_edges(n[p[:idx]], n[arg], :label => type) end
        end
      end
    end

    g.get_node(@root.to_s).set {|_n| _n.color = "blue"} if @root >= 0
    g.get_node(@focus.to_s).set {|_n| _n.color = "red"} if @focus >= 0

    @graph_rendering = g.output(:svg => String)
  end


  # returns an array of...subject, shortest path, and object indices.
  def get_rels
    @rels = []
    @heads.each_with_index do |h1, i|
      @heads[i+1..-1].each do |h2|
        puts "#{h1}, #{h2}"
        path = @graph.shortest_path(h1, h2)
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
  def get_focus
    # find the wh-word
    # assumption: one query has one wh-word
    wh = -1
    @tparses.each do |p|
      if WH_CAT.include?(p[:cat])
        wh = p[:idx]
        break
      end
    end

    @focus =
      if wh > -1
        if @tparses[wh][:args]
          @tparses[wh][:args][0][1]
        else
          wh
        end
      elsif @heads
        @heads[0]
      else
        nil
      end
  end

  # Returns a word based on the index into the PAS.
  # For single words, as opposed to arrays--see below for arrays.
  def idx_get_word(i)
    @tparses[i][:word]
  end

  # From an array of word indices, return an array of words.
  # For arrays, as opposed to single words--see above for single words.
  # The parameter v is a path.  Random walk.
  #
  # Called by lodqa.rb.
  def idxv_get_word(v)
    v.collect {|x| @tparses[x][:word]}
  end

  # Input: a pair of beginning and ending indices.
  # This basically does a sequential walk through the words that appear
  # sequentially in the input sentence.
  def idxs_get_words(s)
    words = []
    unless s == nil
      (s[0]..s[1]).each do |i|
        words.push @tparses[i][:word]
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
#    bnc_so = enju.get_pasgraph(line.chomp)
#    enju.parse_utf8(line.chomp)
    parse = EnjuParse.new(enju_accessor, line.chomp)
    parse.tparses.each do |p|
      p p
    end
    puts "-----"
    p parse.root
    puts "-----"
    p parse.heads
    puts "-----"
    p parse.bnc_span_word_index
    puts "-----"
    p parse.bnc_span_caret_index
    puts "-----"
    p parse.graph
    puts "-----"
    p parse.rels
    puts "-----"

    # enju.get_bnp
    # enju.get_rel
    # bnc_so = enju.get_bnc_so
    # bnc_so.each do |sbeg, send|
    #   puts("#{sbeg+offset}\t#{send+offset}\tBNC\t#{line[sbeg+offset...send+offset]}")
    # end
    # puts
    # pas = enju.get_pas
    # pas.each do |p|
    #   p p
    # end
#    offset += line.length
  end
end
