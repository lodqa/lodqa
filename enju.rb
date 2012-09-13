#!/usr/bin/ruby
# encoding: UTF-8
Encoding.default_external="UTF-8"
Encoding.default_internal="UTF-8"

require 'rest-client'
require 'htmlentities'
require 'graphviz'
require 'diff/lcs'
require 'diff/lcs/string'
require '/opt/services/ontotagger/nlptools/graph'

class Enju

  # nounphrase elements
  NP_CAT = ["DT", "NN", "NNP", "CD", "FW", "PRP", "JJ"]
  NP_HEAD_CAT = ["NN", "NNP", "CD", "FW", "PRP"]

  # nounphrase elements
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

#    @pas.each {|p| p p}

    @pas.collect! do |idx, s_beg, s_end, word, bword, pos, cat, ptype, arel|
      [idx, position_map[s_beg], position_map[s_end], word, bword, pos, cat, ptype, arel]
    end
#    puts "====="
#    @pas.each {|p| p p}
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

        toks = response.split(/\r?\n/)
        toks.each do |t|
          anal = t.split(/\t/, 7)

          ## index
          idx = anal.shift.to_i
          anal.unshift(idx)

          if anal.size > 6
            ## argument relations
            arel = anal.pop
            arel = arel.split.collect {|a| a.split(':')}
            arel = arel.collect {|type, a| [type, a.to_i]}
            anal.push(arel)
          end
          pas << anal
        end

        span = get_tok_so
        die "different number of PAS and spans" if (pas.length != span.length)

        pas.zip(span).each do |p, s|
          idx = p.shift
          p.unshift(s[1])
          p.unshift(s[0])
          p.unshift(idx)
        end
        
        ## graph representation
        node = []
        edge = []
        pas.each do |idx, s_beg, s_end, word, bword, pos, cat, ptype, arel|
          next if idx == 0
          node << [idx, word, pos, cat]

          next if arel.nil?
          arel.each do |type, arg|
            next if arg < 0
            edge << [idx, arg, type]
          end
        end

        g = Graph.new
        edge.each {|pred, arg, type| g.add_edge(pred, arg, 1)}

        @node  = node
        @edge  = edge
        @g     = g
        @pas   = pas
        @root  = pas[0][8][0][1]
      else
        puts "Problem!!"
      end
    end
  end


  def get_tok_so
    @enju_cgi.get :params => {:sentence=>@sentence, :format=>'so'} do |response, request, result|
      case response.code
      when 200
        con = response.split(/\r?\n/)
        tok = con.collect {|c| (c =~ /\ttok /)? c : nil}
        tok.compact!
        tok_so = [[-1, -1]]
        tok.each do |t|
          f = t.split
          tok_so << [f[0].to_i, f[1].to_i]
        end
        tok_so
      else
        abort "Problem!!"
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

    g.output(:png => "temporary/#{filename}")
  end


  def get_bnc
    bnc = []                 # bnc word index (word offset)
    beg, lidx, lcat = -1, -1, ''

    @pas.each do |idx, s_beg, s_end, word, bword, pos, cat|
      next if idx < 0

      if NC_CAT.include?(cat)
        beg = idx if beg < 0
      else
        if beg >= 0
          if NC_HEAD_CAT.include?(lcat)
            bnc << [beg, idx-1]
          end
          beg = -1
        end
      end

      lidx, lcat = idx, cat
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
      bnc_so << [@pas.assoc(b)[1], @pas.assoc(e)[2]]
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
    @pas.each do |idx, s_beg, s_end, word, bword, pos, cat, ptype, arel|
      head << idx if arel.nil?
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
      b.delete_if {|t| !NP_CAT.include?(@pas.assoc(t)[6])}
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
    @pas.each do |idx, s_beg, s_end, word, bword, pos, cat, ptype, arel|
      if WH_CAT.include?(cat)
        wh = idx
        break
      end
    end
    focus = @g.adjacent_node(wh).first if wh > -1

    @focus = focus
  end


  def idx_get_word(i)
    @pas.assoc(i)[3]
  end


  def idxv_get_word(v)
    v.collect {|x| @pas.assoc(x)[3]}
  end

end


if __FILE__ == $0
  enju = Enju.new("http://localhost:31200");

  offset = 0
  ARGF.each do |line|
#    bnc_so = enju.get_pasgraph(line.chomp)
    enju.parse_utf8(line.chomp)
    enju.get_bnp
    enju.get_rel
    bnc_so = enju.get_bnc_so
    bnc_so.each do |sbeg, send|
      puts("#{sbeg+offset}\t#{send+offset}\tBNC")
    end
    offset += line.length
  end
end
