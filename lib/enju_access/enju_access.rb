#!/usr/bin/env ruby
require 'graphviz'
require 'enju_access/cgi_accessor'
#
# It takes a plain-English sentence as input and returns parsing results by accessing an Enju cgi server.
#
module EnjuAccess; end unless defined? EnjuAccess

class << EnjuAccess
  # It generates a SVG expression that shows the predicate-argument
  # structure of the sentence
  def get_graph_rendering(parse)
    return '' if parse.nil? || parse[:root].nil?

    tokens = parse[:tokens]
    root   = parse[:root]
    focus  = parse[:focus]

    g = GraphViz.new(:G, :type => :digraph)
    g.node[:shape] = "box"
    g.node[:fontsize] = 10
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
