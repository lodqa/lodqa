#!/usr/bin/env ruby
#
# An instance of the class searches the SPARQL endpoint for a pseudo graph pattern.
#
require 'json'
require 'sparql/client'
require 'pp'
require 'lodqa/logger'
require 'lodqa/sparql_endpoint_timeout_error'
require 'lodqa/sparql_endpoint_temporary_error'

module Lodqa
  class GraphFinder
    # This constructor takes the URL of an end point to be searched
    # optionally options can be passed to the server of the end point.
    def initialize(pgp, endpoint, graph_uri, options)
      @pgp = pgp
      @endpoint = endpoint
      @graph_uri = graph_uri
      @ignore_predicates = options[:ignore_predicates] || []
      @sortal_predicates = options[:sortal_predicates] || []
      @max_hop = options[:max_hop] || 2
      @sparql_limit = options[:sparql_limit] || 100
      @answer_limit = options[:answer_limit] || 10
    end

    # It generates bgps by applying variation operations to the pgp.
    # The option _max_hop_ specifies the maximum number of hops to be searched.
    def bgps
      Enumerator.new do |y|
        generate_inverse_variations(
          generate_split_variations(
            generate_instantiation_variations(@pgp),
            @max_hop
          )
        )
        .each_with_index do |bgp, idx|
           break if idx > @sparql_limit
           y << bgp
         end
      end
    end

    def each_sparql_and_solution(proc_solution, proc_cancel_flag)
      bgps.each do |bgp|
        sparql = compose_sparql(bgp, @pgp)

        Logger.debug "#{sparql}\n++++++++++"

        begin
          result = @endpoint.query(sparql)
          solution = {
            bgp: bgp,
            sparql: sparql,
            solutions: result.map{ |s| s.to_h }
          }
          proc_solution.call(solution)
        rescue SparqlEndpointTimeoutError => e
          Logger.debug 'Sparql Timeout', error_messsage: e.message, trace: e.backtrace

          # Send back error
          if proc_solution
            proc_solution.call({bgp: bgp, sparql: sparql, sparql_timeout: {error_message: e}, solutions: []})
          end
        rescue SparqlEndpointTemporaryError => e
          Logger.debug 'Sparql Endpoint Error', error_messsage: e.message, trace: e.backtrace

          # Send back error
          if proc_solution
            proc_solution.call({bgp: bgp, sparql: sparql, sparql_timeout: {error_message: e}, solutions: []})
          end
        ensure
          if proc_cancel_flag.call
            Logger.debug "Stop procedure after a sparql query ends"
            return
          end
        end

        Logger.debug "==========\n"

        # TODO http://rdf.pubannotation.org/sparql requires 2 seconds wait ?
        # sleep 2
      end
    end

    def compose_sparql(bgp, pgp)
      nodes = pgp[:nodes]

      # get the variables
      variables = bgp.flatten.uniq - nodes.keys.map(&:to_s)

      # initialize the query
      query  = "SELECT #{variables.map{|v| '?' + v.to_s}.join(' ')}\n"
      query += "FROM <#{@graph_uri}>\n"  unless @graph_uri.nil? || @graph_uri.empty?
      query += "WHERE {"

      # stringify the bgp
      query += bgp.map{|tp| tp.map{|e| nodes.has_key?(e.to_sym) ? "<#{nodes[e.to_sym][:term]}>" : '?' + e}.join(' ')}.join(' . ') + ' .'

      ## constraints on x-variables (including i-variables)
      x_variables = variables.dup.keep_if {|v| v[0] == 'x' or v[0] == 'i'}

      # x-variables to be bound to IRIs
      query += " FILTER (" + x_variables.map{|v| "isIRI(#{'?'+v})"}.join(" && ") + ")" if x_variables.length > 0

      # x-variables to be bound to different IRIs
      x_variables.combination(2) {|c| query += " FILTER (#{'?'+c[0]} != #{'?'+c[1]})"} if x_variables.length > 1

      ## constraintes on p-variables
      p_variables = variables.dup.keep_if{|v| v[0] == 'p'}

      # initialize exclude predicates
      ex_predicates = []

      # filter out ignore predicates
      ex_predicates += @ignore_predicates

      # filter out sotral predicates
      ex_predicates += @sortal_predicates

      unless ex_predicates.empty?
        p_variables.each {|v| query += %| FILTER (str(?#{v}) NOT IN (#{ex_predicates.map{|s| '"'+s+'"'}.join(', ')}))|}
      end

      ## constraintes on s-variables
      s_variables = variables.dup.keep_if{|v| v[0] == 's'}

      # s-variables to be bound to sortal predicates
      s_variables.each {|v| query += %| FILTER (str(?#{v}) IN (#{@sortal_predicates.map{|s| '"'+s+'"'}.join(', ')}))|}

      # query += "}"
      query += "} LIMIT #{@answer_limit}"
    end

    private

    def generate_split_variations(bgps, max_hop = 2)
      Enumerator.new do |sbgps|
        bgps.each do |bgp|
          sortal_tps, non_sortal_tps = bgp.partition{|tp| tp[1].start_with? 's'}
          (1 .. max_hop).to_a.repeated_permutation(non_sortal_tps.length) do |split_scheme|
            split_tps = generate_split_tps(non_sortal_tps, split_scheme)
            sbgps << sortal_tps + split_tps
          end
        end
      end
    end

    def generate_split_tps(tps, split_scheme)
      split_tps = []
      tps.each_with_index do |tp, i|
        x_variables = (1 ... split_scheme[i]).collect{|j| ("x#{i}#{j}").to_s}
        p_variables = (1 .. split_scheme[i]).collect{|j| ("p#{i}#{j}").to_s}

        # terms including x_variables and the initial and the final terms
        terms = [tp[0], x_variables, tp[2]].flatten

        # triple patterns
        stps = (0 ... p_variables.length).collect{|j| [terms[j], p_variables[j], terms[j + 1]]}
        split_tps += stps
      end
      split_tps
    end

    # make variations by inversing each triple pattern
    def generate_inverse_variations(bgps)
      Enumerator.new do |rbgps|
        bgps.each do |bgp|
          sortal_tps, non_sortal_tps = bgp.partition{|tp| tp[1].start_with? 's'}

          [false, true].repeated_permutation(non_sortal_tps.length) do |inverse_scheme|
            rbgps << sortal_tps + non_sortal_tps.map.with_index {|tp, i| inverse_scheme[i]? tp.reverse : tp}
          end
        end
      end
    end

    # make variations by instantiating terms
    def generate_instantiation_variations(pgp)
      return [] if pgp[:edges].empty?

      iids = instantiation_ids pgp
      bgps = [bgp(pgp)]

      instantiated_BGPs(iids, bgps, pgp[:focus])
    end

    def instantiation_ids(pgp)
      iids = {}
      pgp[:nodes].each do |id, node|
        iid = class?(node[:term]) ? 'i' + id.to_s : nil
        iids[id] = iid unless iid.nil?
      end

      iids
    end

    def bgp(pgp)
      connections = pgp[:edges]
      connections.map.with_index{|c, i| [c[:subject].to_sym, "p#{i+1}".to_sym, c[:object].to_sym]}
    end

    def instantiated_BGPs(iids, bgps, focus_id)
      Enumerator.new do |ibgps|
        [false, true].repeated_permutation(iids.keys.length) do |instantiate_scheme|
          # id of the terms to be instantiated
          itids = iids.keys.keep_if.with_index{|t, i| instantiate_scheme[i]}
          next unless itids.include?(focus_id.to_sym)

          if bgps.empty? && !itids.empty?
            ibgp = itids.collect{|t| [iids[t], 's' + t.to_s, t]}
            ibgps << ibgp
          else
            bgps.each do |bgp|
              # initialize the instantiated bgp with the triple patterns for term instantiation
              ibgp = itids.collect{|t| [iids[t].to_s, 's' + t.to_s, t.to_s]}

              # add update triples
              bgp.each{|tp| ibgp << tp.map{|e| itids.include?(e)? iids[e].to_s : e.to_s}}

              ibgps << ibgp
            end
          end
        end
      end
    end

    def uri?(term)
      term.start_with? 'http://'
    end

    def class?(term)
      return @endpoint.query(sparql_for(term)).length > 0 if /^http:/.match(term)

      false
    end

    def sparql_for(term)
      sparql  = "SELECT ?p\n"
      sparql += "FROM <#{@graph_uri}>\n"  unless @graph_uri.nil? || @graph_uri.empty?
      sparql += "WHERE {?s ?p <#{term}> FILTER (str(?p) IN (#{@sortal_predicates.map{|s| '"'+s+'"'}.join(', ')}))} LIMIT 1"
      sparql
    end


    def stringify_term(t)
      if (t.class == RDF::URI)
        %|<#{t.to_s}>|
      elsif (t.class == RDF::Literal)
        if (t.datatype.to_s == "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString")
          %|"#{t.to_s}"@en|
        else
          t.to_s
        end
      else
        %|?#{t}|
      end
    end

    # def stringify_term (t)
    #   if (t.class == RDF::URI)
    #     %|<#{t.to_s}>|
    #   elsif (t.class == RDF::Literal)
    #     if (t.datatype.to_s == "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString")
    #       %|"#{t.to_s}"@en|
    #     else
    #       t.to_s
    #     end
    #   else
    #     %|?#{t}|
    #   end
    # end

    # the sparql-client gem does not support FILTER pattern
    def _compose_sparql(x_variables, p_variables, bgp)
      query = @endpoint.select(*p_variables, *x_variables).where(*bgp).limit(10)
      query.to_s
    end
  end
end

if __FILE__ == $0
  APIKEY = "4d9b44c5-5aad-4c3e-9692-e7490b860896"
  EP_URL = "http://sparql.bioontology.org/sparql/?apikey=#{APIKEY}&outputformat=json"

  IGNORE_PREDICATES = [
    "http://rdfs.org/ns/void#inDataset",
    "http://bio2rdf.org/omim_vocabulary:refers-to",
    "http://bio2rdf.org/omim_vocabulary:article",
    "http://bio2rdf.org/omim_vocabulary:mapping-method"
    # "http://purl.bioontology.org/ontology/MEDLINEPLUS/SIB"
  ]

  SORTAL_PREDICATES = [
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    "http://www.w3.org/2000/01/rdf-schema#subClassOf",
    "http://bioportal.bioontology.org/ontologies/umls/hasSTY"
  ]

  query_graph = {
    :nodes => {
      "t1" => {
        :head => 1,
        :text => "genes"
      },
      "t2" => {
        :head => 5,
        :text => "diabetes"
      }
    },
    :edges => [
      {
        :subject => "t1",
        :object => "t2",
        :text => "related to"
      }
    ],
    :focus => "t1"
  }

  apgp = {
    :nodes=> {
      "t1"=> {
        "text" => "drugs",
        :term => "http://www4.wiwiss.fu-berlin.de/drugbank/resource/drugbank/drugs"
      },
      "t2"=> {
        "text" => "strokes",
        :term => "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1098"
      },
      "t3"=> {
        "text" => "arthrosis",
        :term => "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0022408"
      }
    },
    :focus=>"t1",
    :edges=> [
      {"object"=>"t2", "subject"=>"t1", "text"=>"associated with and"},
      {"object"=>"t3", "subject"=>"t1", "text"=>"associated with and"}
    ]
  }

  endpoint = SPARQL::Client.new('http://rdf.pubannotation.org/sparql')
  max_hop = 3
  options = {:max_hop => max_hop, :ignore_predicates => IGNORE_PREDICATES, :sortal_predicates => SORTAL_PREDICATES, :debug => true}
  # options = {:max_hop => max_hop, :ignore_predicates => IGNORE_PREDICATES, :sortal_predicates => SORTAL_PREDICATES}

  query_graph = JSON.parse File.read (ARGV[0]) unless ARGV[0].nil?
  max_hop = ARGV[1] unless ARGV[1].nil?

  gf = GraphFinder.new(apgp, endpoint, nil, options)
  # sparqls = gf.sparqls
  # puts sparqls.join("\n-----\n")
end
