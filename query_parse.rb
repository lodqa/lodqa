#!/usr/bin/env ruby
#
# It produces a SPARQL query from a query in Enlgish.
#
require_relative 'enjuparse'
require 'net/http'
require 'json'

# An instance of this class holds the result of SPARQL generation together with by-products.
class QueryParse
  # Parsing result. See Enjuparse.
  attr_reader :parse
  # Term expressions
  attr_reader :term_exps
  # Predicate expressions
  attr_reader :pred_exps
  # Term-URI mapping
  attr_reader :term_uris
  # Pseudo SPARQL query
  attr_reader :psparql
  # SPARQL query
  attr_reader :sparql

  def initialize (query, enju_accessor, dictionary_accessor, graph_uri)
    @parse = EnjuParse.new(enju_accessor, query)

    term_vars, @term_exps = get_term_instantiation(parse)
    pred_vars, @pred_exps = get_pred_instantiation(parse)
    @psparql   = get_psparql(term_vars, term_exps, pred_vars, pred_exps, parse)

    @term_uris = get_term_uris(dictionary_accessor, parse.heads, term_exps)

    @sparql    = get_sparql(term_vars, term_exps, term_uris, pred_vars, pred_exps, parse, graph_uri)
  end

  def get_term_instantiation (parse)
    if parse.heads
      term_vars = Hash.new            # term variables
      term_exps = Hash.new            # term expressions

      v = 't0'
      parse.heads.each do |h|
        v = v.next
        term_vars[h] = v
        term_span    = parse.token_index_bncs[h]
        term_exps[h] = (term_span[0] .. term_span[1]).collect{|i| parse.tparses[i][:word]}.join(' ')
      end

      return term_vars, term_exps
    else
      return nil, nil
    end
  end


  def get_pred_instantiation (parse)
    if parse.heads
      pred_vars = Hash.new            # pred variables
      pred_exps = Hash.new            # pred expressions

      v = 'p0'
      parse.rels.each do |s, p, o|
        v = v.next
        pred_vars[p] = v
        pred_exps[p] = p.collect{|i| parse.tparses[i][:word]}.join(' ')
      end

      return pred_vars, pred_exps
    else
      return nil, nil
    end
  end


  ## pseudo sparql
  def get_psparql (term_vars, term_exps, pred_vars, pred_exps, parse)
    psparql    = "SELECT ?#{term_vars[parse.focus]}\nWHERE {\n"
    parse.heads.each do |h|
      psparql += "   ?#{term_vars[h]} [:isa] [#{term_exps[h]}] . \n"
    end
    parse.rels.each do |s, p, o|
      psparql += "   ?#{term_vars[s]} [#{pred_exps[p]}] ?#{term_vars[o]} . \n"
    end
    psparql   += "}"
  end


  def get_term_uris(dictionary_accessor, heads, term_exps)
    terms = heads.collect{|i| term_exps[i]}
    # return {"genes" => ["http://bioportal.bioontology.org/ontologies/umls/sty/T028"], "kabuki syndrome" => ["http://purl.bioontology.org/ontology/OMIM/147920"]}
    # RestClient.post "http://localhost:3000", {:annotation => {:terms => terms}.to_json}, :content_type => :json, :accept => :json
    # return

    dictionary_accessor.post :terms => terms.to_json do |response, request, result|
      case response.code
      when 200
        result = JSON.parse response
      else
        p response
      end
    end
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
