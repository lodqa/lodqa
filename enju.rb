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


  def parse (sentence)
    @sentence = sentence
    @pas   = []
    @root  = -1
    @bnc   = []
    @head  = []
    @bnp   = []
    @focus = -1

    @enju_cgi.get :params => {:sentence=>sentence, :format=>'conll'} do |response, request, result|
      case response.code
      when 200
        pas = []                # predicate-argument structures

        toks = response.split(/\r?\n/)  #tokens
        toks.each do |t|
          dat = t.split(/\t/, 7)
          anal = Hash.new
          anal[:idx] = dat[0].to_i
          anal[:word] = dat[1]
          anal[:base] = dat[2]
          anal[:pos] = dat[3]
          anal[:cat] = dat[4]
          anal[:type] = dat[5]
          anal[:arg] = dat[6].split.collect{|a| type, ref = a.split(':'); [type, ref.to_i]} if dat[6]
          pas << anal
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


  def get_pas
    @pas
  end


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


  def get_bnc
    bnc = []                 # bnc word index (word offset)
    beg, lidx, lcat = -1, -1, ''

    @pas.each do |p|
      next if p[:idx] < 0

      if NC_CAT.include?(p[:cat])
        beg = p[:idx] if beg < 0
      else
        if beg >= 0
          if NC_HEAD_CAT.include?(lcat)
            bnc << [beg, p[:idx]-1]
          end
          beg = -1
        end
      end

      lidx, lcat = p[:idx], p[:cat]
    end

    if (beg >= 0) && NC_HEAD_CAT.include?(lcat)
        bnc << [beg, lidx]
    end

    @bnc = bnc
  end


  def get_bnc_so
    get_bnc if @bnc.empty?

    bnc_so = []                # bnc stand-off (character offset)
    @bnc.each do |b, e|
      bnc_so << [@pas[b][:beg], @pas[e][:end]]
    end
    bnc_so.sort! {|a, b| a[0] <=> b[0] || b[1] <=> a[1]}
    bnc_so
  end


  def get_bnc_head
    get_bnc if @bnc.empty?

    bnc_head = []                 # bnc head word index (word offset)
    beg, lidx, lcat = -1, -1, ''
    @bnc.each do |f, l|
      bnc_head << l
    end
    bnc_head
  end


  def get_head
    head = []                 # head word index (word offset)
    @pas.each do |p|
      head << p[:idx] unless p[:arg]
    end
    @head = head
  end


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
    focus = @g.adjacent_node(wh).first if wh > -1

    @focus = focus
  end


  def idx_get_word(i)
    @pas[i][:word]
  end


  def idxv_get_word(v)
    v.collect {|x| @pas[x][:word]}
  end

end


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
