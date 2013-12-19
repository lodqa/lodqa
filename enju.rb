#!/usr/bin/env ruby
# encoding: UTF-8
Encoding.default_external="UTF-8"
Encoding.default_internal="UTF-8"
require 'rest-client'
require 'htmlentities'
require 'graphviz'
require 'diff/lcs'
require 'diff/lcs/string'
require './graph'

class Enju

  # nounphrase elements
  NP_CAT = ["DT", "NN", "NNP", "CD", "FW", "PRP", "JJ"]
  NP_HEAD_CAT = ["NN", "NNP", "CD", "FW", "PRP"]

  # noun-chunk elements
  NC_CAT      = ["NN", "NNP", "CD", "FW", "JJ"]
  NC_HEAD_CAT = ["NN", "NNP", "CD", "FW"]

  # wh-
  WH_CAT = ["WP", "WDT"]


  def initialize (url)
    @enju_cgi = RestClient::Resource.new url + "/cgi-lilfes/enju"
    @coder = HTMLEntities.new
  end


  def parse_utf8 (sen_utf8)
    ## change encoding from utf8 to ascii

    # change encoding to ascii, escaping non-ascii characters
    sen_ascii = @coder.encode(sen_utf8, :named)

    # restore back some text characters
    sen_ascii.gsub!('&apos;', "'")
    sen_ascii.gsub!('&lt;', '<')
    sen_ascii.gsub!('&gt;', '>')

    # change escape characters for enju
    sen_ascii.gsub!(/&([a-zA-Z]{1,10});/, '==\1==')

    ## parsing
    parse(sen_ascii)

    ## adjust the offsets for the original sentence
    position_map = Hash.new
    Diff::LCS.sdiff(sen_ascii, sen_utf8) do |h|
      position_map[h.old_position] = h.new_position
    end

    @pas.each do |p|
      p[:beg] = position_map[p[:beg]]
      p[:end] = position_map[p[:end]]
    end
  end

  # Takes a plain-English sentence as input.
  # Populates a bunch of instance variables that represent various aspects
  # of the PAS and syntactic structure of the sentence.
  # Return value is actually the value of the root, but that is a side
  # effect, so don't depend on it.
  def parse (sentence)
    @sentence = sentence
    @pas   = []
    @root  = -1
    @bnc   = []
    @head  = []
    @bnp   = []
    @focus = -1

    # Response is the result of the parse in CONLL format.
    # response will look like this:
    # ...
    # request will look like this:
    # ...
    # result will look like this:
    # ...
    @enju_cgi.get :params => {:sentence=>sentence, :format=>'conll'} do |response, request, result|
      case response.code
      when 200                  # 200 means success
        pas = []                # predicate-argument structures

        toks = response.split(/\r?\n/)  #tokens
        toks.each do |t|
          dat = t.split(/\t/, 7)
          analysis = Hash.new
          analysis[:idx] = dat[0].to_i
          analysis[:word] = dat[1]
          analysis[:base] = dat[2]
          analysis[:pos] = dat[3]
          analysis[:cat] = dat[4]
          analysis[:type] = dat[5]
          analysis[:arg] = dat[6].split.collect{|a| type, ref = a.split(':'); [type, ref.to_i]} if dat[6]
          pas << analysis  # << is push operation
        end

        # get span offsets
        i = 0
        pas.each do |p|
          if p[:idx] == 0
            p[:beg] = -1
            p[:end] = -1
          else
            i += 1 until sentence[i] !~ /[ \t\n]/
            abort "span mismatch: #{i} #{p[:word]}" unless sentence.index(p[:word], i) == i
            p[:beg] = i
            p[:end] = i + p[:word].length
            i = p[:end]
          end
        end

        abort "span mismatch in the end (#{sentence.length} : #{i})\n[#{sentence[i..-1]}]" unless sentence.length - i < 2

        ## graph representation
        node = []
        edge = []
        pas.each do |p|
          next if p[:idx] == 0
          node << [p[:idx], p[:word], p[:pos], p[:cat]]

          next unless p[:arg]
          p[:arg].each do |type, arg|
            next if arg < 0
            edge << [p[:idx], arg, type]
          end
        end

        g = Graph.new
        edge.each {|pred, arg, type| g.add_edge(pred, arg, 1)}

        @node  = node
        @edge  = edge
        @g     = g
        @pas   = pas
        @root  = pas[0][:arg][0][1]
      else
        puts "Connection problem!!"
      end
    end
  end

  # The @pas data structure gets populated by the parse() method.
  # Is it guaranteed to be non-null?
  def get_pas
    @pas
  end

  # generates a graphics file that shows the predicate-argument 
  # structure of the sentence
  def gen_pasgraph(filename)
    get_focus if @focus == -1

    g = GraphViz.new(:G, :type => :digraph)
    g.node[:shape] = "box"
    g.node[:fontsize] = 11
    g.edge[:fontsize] = 9

    ## add nodes
    n = []
    @node.each {|idx, word, pos, cat|
      n[idx] = g.add_nodes(idx.to_s, :label => "#{word}/#{pos}/#{cat}")
      #n[idx] = g.add_nodes(idx.to_s, :label => "#{word}")
    }

    g.get_node(@root.to_s).set {|_n| _n.color = "blue"}
    g.get_node(@focus.to_s).set {|_n| _n.color = "red"}

    ## add edges
    @edge.each {|pred, arg, type| g.add_edges(n[pred], n[arg], :label => type)}

    g.output(:png => "public/temporary/#{filename}")
  end


  # returns a hash of word indices to arrays of begining and ending indices.
  # It maps from a word's index to the slice of the array that contains that
  # word within a base noun chunk. 
  # Assumption: last word of the BNC is the head.
  def get_bnc
    bnc = {}                      # bnc word index (word offset)
    beg, lidx, lcat = -1, -1, ''  # begining index, last index, last category
    @pas.each do |p|
      next if p[:idx] < 0

      if NC_CAT.include?(p[:cat])
        beg = p[:idx] if beg < 0
      else
        if beg >= 0
          if NC_HEAD_CAT.include?(lcat) and @head.include?(lidx)
            bnc[lidx] = [beg, lidx]
          end
          beg = -1
        end
      end

      lidx, lcat = p[:idx], p[:cat]
    end

    if (beg >= 0) and NC_HEAD_CAT.include?(lcat) and @head.include?(lidx)
        bnc[lidx] = [beg, lidx]
    end

    @bnc = bnc
  end

  # Returns a sorted array of base noun chunks represented by pairs
  # of offsets of beginning character and ending character.
  def get_bnc_so
    get_bnc if @bnc.empty?

    bnc_so = []                # bnc stand-off (character offset)
    @bnc.each_pair do |hidx, span|
      bnc_so << [@pas[span[0]][:beg], @pas[span[1]][:end]]
    end
    bnc_so.sort! {|a, b| a[0] <=> b[0] || b[1] <=> a[1]}
    bnc_so
  end

  # Returns an array of head words of base noun chunks, represented as
  # word index of each head word
  def get_bnc_head
    get_bnc if @bnc.empty?

    bnc_head = []                 # bnc head word index (word offset)
    beg, lidx, lcat = -1, -1, ''
    @bnc.each do |f, l|
      bnc_head << l # push operator <<
    end
    bnc_head
  end

  # This returns indices of heads of base noun phrases 
  # AND the head of the verb phrase.
  # So, for the input 
  #
  # Show me devices used to treat heart failure
  #
  # ...it will return
  #
  # 2, 3, 7

  def get_head
    head = []                 # head word index (word offset)
    @pas.each do |p|
      head << p[:idx] unless p[:arg]
    end
    @head = head
  end

  # returns a hash of heads to the noun phrases that they are the heads of.
  def get_bnp
    get_head if @head.empty?

    bnp = {}
    @head.each do |h|
      bnp[h] = @g.adjacent_node(h).push(h).sort
    end

    bnp.each do |k, b|
      b.delete_if {|t| !NP_CAT.include?(@pas[t][:cat])}
    end

    bnp
  end


  # returns an array of...subject, shortest path, and object indices.
  def get_rel
    get_focus if @focus == -1

    rel = []
    for i in 0..(@head.length - 2)
      path = @g.shortest_path(@head[i], @head[i+1])
      s = path.shift
      o = path.pop
      p = path
      rel << [s, p, o] 
    end
    rel
  end


  # returns the index of the "focus word."  For example, for the input
  # 
  # What devices are used to treat heart failure?
  #
  # ...it will return 2.
  def get_focus
    get_head if @head.empty?
    focus = @head[0]

    wh = -1
    @pas.each do |p|
      if WH_CAT.include?(p[:cat])
        wh = p[:idx]
        break
      end
    end

    if wh > -1
      whmod = @edge.assoc(wh)
      if whmod
        focus = whmod[1]
      else
        focus = wh
      end
    end

    @focus = focus
  end

  # Returns a word based on the index into the PAS.
  # For single words, as opposed to arrays--see below for arrays.
  def idx_get_word(i)
    @pas[i][:word]
  end

  # From an array of word indices, return an array of words.
  # For arrays, as opposed to single words--see above for single words.
  # The parameter v is a path.  Random walk.
  #
  # Called by lodqa.rb.
  def idxv_get_word(v)
    v.collect {|x| @pas[x][:word]}
  end

  # Input: a pair of beginning and ending indices.
  # This basically does a sequential walk through the words that appear
  # sequentially in the input sentence.
  def idxs_get_words(s)
    words = []
    unless s == nil
      (s[0]..s[1]).each do |i|
        words.push @pas[i][:word]
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
  enju = Enju.new("http://bionlp.dbcls.jp/enju");

  offset = 0
  ARGF.each do |line|
#    bnc_so = enju.get_pasgraph(line.chomp)
#    enju.parse_utf8(line.chomp)
    enju.parse(line.chomp)
    enju.get_bnp
    enju.get_rel
    bnc_so = enju.get_bnc_so
    bnc_so.each do |sbeg, send|
      puts("#{sbeg+offset}\t#{send+offset}\tBNC\t#{line[sbeg+offset...send+offset]}")
    end
    puts
    pas = enju.get_pas
    pas.each do |p|
      p p
    end
#    offset += line.length
  end
end
