#!/usr/bin/env ruby
#
# It parses a query and produces its parse rendering and PGP.
#
require 'net/http'
require 'pp'
require 'enju_access/cgi_accessor'

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

  def template
    pgp2template(pgp)
  end

  private

  def pgp2template(pgp)
    nodes, edges, focus = pgp[:nodes], pgp[:edges], pgp[:focus].to_sym

    pattern_what = true if nodes[focus][:text].downcase == 'what'
    pattern_noun = !pattern_what
    pattern_noun_of = true if !pattern_what && edges.find{|e| e[:subject].to_sym == focus && e[:text] == 'of'}

    query  = "SELECT ?#{focus} WHERE {"
    if pattern_noun_of
      # do nothing here
    elsif pattern_noun
      query += " ?#{focus} ?p0 ?c#{focus} ."
    end
    query += edges.map.with_index{|e, i| " ?#{e[:subject]} ?p#{i+1} ?#{e[:object]} ."}.join
    query += " }"

    slots = []

    nodes.each do |k, n|
      next if pattern_what && k == focus
      next if pattern_noun_of && k == focus

      v    = (k == focus) ? "c#{k}" : k
      type = (k == focus) ? "rdf:Class" : "rdf:Class|rdf:Resource"
      text = n[:text]
      text = "person" if text.downcase == 'who'

      slots << {s:v, p:"is", o:type}
      slots << {s:v, p:"verbalization", o:text}
    end

    slots << {s:"p0", p:"is", o:"<http://lodqa.org/vocabulary/sort_of>"} if pattern_noun && !pattern_noun_of

    edges.each_with_index do |e, i|
      if pattern_noun_of && e[:subject].to_sym == focus && e[:text] == 'of'
        slots << {s:"p#{i+1}", p:"is", o:"rdf:Property"}
        slots << {s:"p#{i+1}", p:"verbalization", o:nodes[focus][:text]}
      else
        slots << {s:"p#{i+1}", p:"is", o:"rdf:Property"}
        slots << {s:"p#{i+1}", p:"verbalization", o:e[:text]}
      end
    end

    {query:query, slots:slots}
  end

  def graphicate(parse)
    # [Exception Handling] Treat the entire sentence as a BNC when no BNC was found
    if parse[:base_noun_chunks].empty?
      last_idx = parse[:tokens].last[:idx]
      parse[:base_noun_chunks] << {head:last_idx, beg:0, end:last_idx}
    end

    nodes = get_nodes(parse)

    # index the nodes by their heads
    node_index = {}
    nodes.each_key{|k| node_index[nodes[k][:head]] = k}

    # get the focus
    focus = node_index[parse[:focus]]

    # default rule: take the first one as the focus, if no grammatical focus is found.
    focus = node_index.values.first if focus.nil?

    edges = get_edges(parse, node_index)

    post_processing!(nodes, edges)

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
  def post_processing!(nodes, edges)
    # 'and' coordination
    edges.reject!{|e| e[:text] == 'and'}

    # 'have A as B' pattern
    edges_have_as = edges.find_all{|e| e[:text] == "have as"}
    unless edges_have_as.empty?
      pairs_have_as = edges_have_as.group_by{|e| e[:object]}
      pairs_have_as.each do |obj, pair|
        edge_have = edges.find do |e|
          e[:text] == "have" &&
          ((e[:subject] == pair.first[:subject] && e[:object] == pair.last[:subject]) || (e[:subject] == pair.last[:subject] && e[:object] == pair.first[:subject]))
        end
        if edge_have
          edge_have[:text] = nodes[obj.to_sym][:text]
          nodes.delete(obj.to_sym)
        end
      end
      edges.reject!{|e| e[:text] == "have as"}
    end

    # 'have A and B as C' pattern
    edges_have_and_as = edges.find_all{|e| e[:text] == "have and as"}
    edges_have_and_as.each do |edge_have_and_as|
      edges_and_as = edges.find_all{|e| e[:text] == "and as" && e[:object] == edge_have_and_as[:object]}
      edges_have_and = edges_and_as.map{|edge_and_as| edges.find{|e| e[:text] == "have and" && e[:object] == edge_and_as[:subject]}}
      edges_have_and.each{|e| e[:text] = nodes[edge_have_and_as[:object].to_sym][:text]}
      nodes.delete(edge_have_and_as[:object].to_sym)
    end
    edges.reject!{|e| e[:text] == "have and as"}
    edges.reject!{|e| e[:text] == "and as"}
  end
end
