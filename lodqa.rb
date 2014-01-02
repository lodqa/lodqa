#!/usr/bin/env ruby
#encoding: UTF-8
require_relative './enjuparse'
require_relative './tuilookup'
require 'net/http'
require 'json'
require 'uri'


class SparqlGenerator
  def initialize (enju_url, ontofinder_url, tui_xml_filename)
    @enju_accessor       = RestClient::Resource.new enju_url
    @ontofinder_accessor = RestClient::Resource.new ontofinder_url
    begin
      @tuis = TUILookup.new(tui_xml_filename)
    rescue
      raise
    end
  end

  def nlq2sparql (query, oid, oacronym)
    sparql = QueryParse.new(@enju_accessor, @ontofinder_accessor, @tuis, query, oid, oacronym)
  end
end


class QueryParse
  attr_reader :query_annotation, :pasgraph, :psparql, :term_exps, :pred_exps, :term_uris, :sparql

  def initialize (enju_accessor, ontofinder_accessor, tuis, query, oid, oacronym)
    parse = EnjuParse.new(enju_accessor, query)

    @query_annotation = get_query_annotation(query, parse.bnc_span_caret_index.values)
    @pasgraph = parse.graph_rendering

    term_vars, @term_exps = get_term_instantiation(parse)
    pred_vars, @pred_exps = get_pred_instantiation(parse)

    @psparql   = get_psparql(term_vars, term_exps, pred_vars, pred_exps, parse)
    @term_uris = get_term_uris(ontofinder_accessor, parse.heads, term_exps, oid)
    @sparql    = get_sparql(term_vars, term_exps, term_uris, pred_vars, pred_exps, parse, tuis, oid, oacronym)
  end


  def get_query_annotation (query, bnc_spans)
    so = bnc_spans.collect{|c| c.push("BNC")}

    aquery, last = '', 0
    so.each do |cbeg, cend, label|
      aquery += query[last...cbeg]
      aquery += "<span class='#{label}'>"
      aquery += query[cbeg...cend]
      aquery += '</span>'
      last = cend
    end
    aquery += query[last..-1]
  end


  def get_term_instantiation (parse)
    if parse.heads
      term_vars = Hash.new            # term variables
      term_exps = Hash.new            # term expressions

      v = 't0'
      parse.heads.each do |h|
        v = v.next
        term_vars[h] = v
        term_span    = parse.bnc_span_word_index[h]
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


  def get_term_uris(ontofinder_accessor, heads, term_exps, vid)
    terms = heads.collect{|i| term_exps[i]}
    response = ontofinder_accessor.post :data => terms.join("\n"), :vids => vid.to_s, :content_type => 'multipart/form-data', :accept => :json
    term_uris =
      case response.code
      when 200
        uris = JSON.parse(response)
        Hash[heads.zip(uris)]
      else
        nil
      end
  end


  # to generate sparql (using UNION; when VALIUES constructs are not allowed)
  def get_sparql(term_vars, term_exps, term_uris, pred_vars, pred_exps, parse, tuis, vid, acronym)
    term_uris[parse.focus] = tuis.lookup(term_exps[parse.focus])

    sparql  = "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n"
    sparql += "SELECT DISTINCT ?#{term_vars[parse.focus]} ?l1\n"
    sparql += "WHERE {\n"
    sparql += "  GRAPH <http://bioportal.bioontology.org/ontologies/#{acronym}> {\n"

    combinations = []
    parse.heads.each do |h|

      if combinations.empty?
        combinations = term_uris[h].collect{|u| [u]}
      else
        combinations_new = []
        combinations.each do |c|
          if term_uris[h].empty?
            combinations_new << (c + [nil])
          else
            term_uris[h].each do |u|
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
          if (h == parse.focus)
            group += %Q(    ?#{term_vars[h]} <http://bioportal.bioontology.org/ontologies/umls/tui> "#{c[i]}"^^xsd:string .\n)
          else
            v = v.next
            group += %Q(    ?#{term_vars[h]} ?#{v} <#{c[i]}> .\n)
          end
        end
      end
      parse.rels.each {|s, p, o| group += %Q(    ?#{term_vars[s]} ?#{pred_vars[p]} ?#{term_vars[o]} .\n)}
      group += %Q(    ?#{term_vars[parse.focus]} <http://www.w3.org/2004/02/skos/core#prefLabel> ?l1.\n)

      groups << group
    end
    if groups.length == 1
      sparql += groups.first
    else
      sparql += "    {\n" + groups.join("    }\n    UNION\n    {\n") + "    }\n"
    end

    sparql += %Q(  }\n)
    sparql += %Q(})
  end

end


if __FILE__ == $0

  ## configuration
  require 'parseconfig'
  config = ParseConfig.new('./lodqa.cfg')
  endpoint_url   = config['endpointURL']
  enju_url       = config['enjuURL']
  ontofinder_url = config['ontofinderURL']
  query          = config['Query']
  oid            = config['ontologyId']
  oacronym       = config['ontologyAcronym']

  ## query from the command line
  unless ARGV.empty?
    query   = ARGV[0]
    vid     = ARGV[1]
    acronym = ARGV[2]
  end

  g = SparqlGenerator.new(enju_url, ontofinder_url, "semanticTypes.xml")
  p = g.nlq2sparql(query, oid, oacronym)
  p p.query_annotation
  puts "-----"
  puts p.psparql
  puts "-----"
  p p.term_uris
  puts "-----"
  puts p.sparql
  puts "-----"

  # p.parse(query)
  # psparql = qp.get_psparql
  # puts psparql

  # sparql  = qp.get_sparql(vid, acronym)
  # puts sparql

  ## result
  # require 'sparql/client'
  # endpoint = SPARQL::Client.new(endpoint_url)
  # result = endpoint.query(sparql)
  # result.each {|s| puts s[:t1] + "\t" + s[:l1]}
end
