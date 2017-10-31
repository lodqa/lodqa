#!/usr/bin/env ruby
#
# It parses a query and produces its parse rendering and PGP.
#
require 'net/http'
require 'pp'

module Lodqa; end unless defined? Lodqa

# An instance of this class is initialized with a dictionary.
class Lodqa::Graphicator
  attr_reader :parser

  def initialize(parser_url)
    raise ArgumentError, "parser_url should be given." if parser_url.nil? || parser_url.empty?
    @parser = EnjuAccess::CGIAccessor.new(parser_url)
  end

  def parse(query)
    @parse = @parser.parse(query)
    self
  end

  def pgp
    graphicate(@parse)
  end

  private

  def graphicate(parse)
    nodes = get_nodes(parse)

    # index the nodes by their heads
    node_index = {}
    nodes.each_key{|k| node_index[nodes[k][:head]] = k}

    # get the focus
    focus = node_index[parse[:focus]]

    # default rule: take the first one as the focus, if no grammatical focus is found.
    focus = node_index.values.first if focus.nil?

    edges = get_edges(parse, node_index)

    post_processing!(edges)

    {
      :nodes => nodes,
      :edges => edges,
      :focus => focus.to_s
    }
  end

  def get_nodes(parse)
    nodes = {}

    variable = 't0'
    parse[:base_noun_chunks].each do |c|
      variable = variable.next;
      nodes[variable.to_sym] = {
        :head => c[:head],
        :text => parse[:tokens][c[:beg] .. c[:end]].collect{|t| t[:lex]}.join(' ')
      }
    end

    nodes
  end

  def get_edges(parse, node_index)
    parse[:relations].collect do |s, p, o|
      {
        :subject => node_index[s].to_s,
        :object => node_index[o].to_s,
        :text => p.collect{|i| parse[:tokens][i][:lex]}.join(' ')
      }
    end
  end

  # post_processing may be dependent on Enju
  def post_processing!(edges)
    # 'and' coordination
    edges.reject!{|e| e[:text] == 'and'}
  end
end
