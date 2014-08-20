#!/usr/bin/env ruby
#
# It produces a SPARQL query from a query in Enlgish.
#
require_relative 'enju_accessor'
require 'net/http'
require 'json'

# An instance of this class is initialized with a dictionary.
class Graphicator
  def initialize (dictionary_url)
    @dictionary = RestClient::Resource.new dictionary_url, :headers => {:content_type => :json, :accept => :json}
  end

  def graphicate (parse)
    nodes = get_nodes(parse)
    edges = get_edges(nodes, parse)
    graph = {
      :nodes => nodes,
      :edges => edges,
      :focus => parse[:focus]
    }
  end

  def get_nodes (parse)
    variable = 't0'
    nodes = parse[:base_noun_chunks].collect do |c|
      variable = variable.next;
      {
        :id => variable,
        :head => c[:head],
        :text => parse[:tokens][c[:beg] .. c[:end]].collect{|t| t[:lex]}.join(' ')
      }
    end
  end

  def get_edges (nodes, parse)
    node_index = nodes.collect{|n| [n[:head], n[:id]]}.to_h
    edges = parse[:relations].collect do |s, p, o|
      {
        :subject => node_index[s],
        :object => node_index[o],
        :text => p.collect{|i| parse[:tokens][i][:lex]}.join(' ')
      }
    end
  end

  def find_uris (nodes)
    terms = nodes.collect{|n| n[:text]}
    # return {"genes" => ["http://bioportal.bioontology.org/ontologies/umls/sty/T028"], "kabuki syndrome" => ["http://purl.bioontology.org/ontology/OMIM/147920"]}
    # RestClient.post "http://localhost:3000", {:annotation => {:terms => terms}.to_json}, :content_type => :json, :accept => :json
    # return

    uris = @dictionary.post :terms => terms.to_json do |response, request, result|
      case response.code
      when 200
        JSON.parse response
      else
        nil
      end
    end

    puts "[URI lookup]"
    p uris
    puts "-----"

    # nodes.each{|n| n[:term] = uris[n[:text]].map{|u| "<#{u}>"}[0]}
    nodes.collect{|n| uris[n[:text]].map{|u| "<#{u}>"}}
  end


  # to generate sparql (using UNION; when VALIUES constructs are not allowed)
  def get_sparql(term_vars, term_exps, term_uris, pred_vars, pred_exps, parse, graph_uri)
    sparql  = "SELECT DISTINCT ?#{term_vars[parse.focus]}\n"
    sparql += "WHERE {\n"
    sparql += "  GRAPH <#{graph_uri}> {\n" if graph_uri

    combinations = []
    parse.heads.each do |h|
      uris = term_uris[@term_exps[h]]

      if combinations.empty?
        combinations = uris.collect{|u| [u]}
      else
        combinations_new = []
        combinations.each do |c|
          if uris.empty?
            combinations_new << (c + [nil])
          else
            uris.each do |u|
              combinations_new << (c + [u])
            end
          end
        end
        combinations = combinations_new
      end

    end

    v = 'd0'
    groups = [];
    combinations.each do |c|
      group = ''
      parse.heads.each_with_index do |h, i|
        unless c[i] == nil
          v = v.next
          group += %Q(    ?#{term_vars[h]} ?#{v} <#{c[i]}> .\n)
        end
      end
      parse.rels.each {|s, p, o| group += %Q(    ?#{term_vars[s]} ?#{pred_vars[p]} ?#{term_vars[o]} .\n)}
      # group += %Q(    ?#{term_vars[parse.focus]} <http://www.w3.org/2004/02/skos/core#prefLabel> ?l1.\n)

      groups << group
    end
    if groups.length == 1
      sparql += groups.first
    else
      sparql += "    {\n" + groups.join("    }\n    UNION\n    {\n") + "    }\n"
    end

    sparql += %Q(  }\n) if graph_uri
    sparql += %Q(})
  end

end
