#!/usr/bin/env ruby
#
# An instance of the class searches the SPARQL endpoint for a pseudo graph pattern.
#
require 'json'
require 'sparql/client'
require 'pp'

class GraphFinder
  # This constructor takes the URL of an end point to be searched
  # optionally options can be passed to the server of the end point.
  def initialize (pgp, endpoint, graph_uri, options = {})
    options ||= {}
    @debug = options[:debug] || false

    @pgp = pgp
    @endpoint = endpoint
    @graph_uri = graph_uri
    @ignore_predicates = options[:ignore_predicates] || []
    @sortal_predicates = options[:sortal_predicates] || []

    max_hop = options[:max_hop] || 2
    @bgps = gen_bgps(pgp, max_hop)
  end

  # It generates bgps by applying variation operations to the pgp.
  # The option _max_hop_ specifies the maximum number of hops to be searched.
  def gen_bgps (pgp, max_hop = 1)
    if @debug
      puts "=== [Pseudo Graph Pattern] ====="
      p pgp
      puts "=== [Maximum number of hops]: #{max_hop} ====="
    end

    bgps = generate_instantiation_variations(pgp)
    if @debug
      puts "=== [instantiation variations] ====="
      bgps.each {|bgp| pp bgp}
    end

    bgps = generate_split_variations(bgps, max_hop)

    if @debug
      puts "=== [split variations] ====="
      bgps.each {|bgp| p bgp}
    end

    bgps = generate_inverse_variations(bgps)
    if @debug
      puts "=== [inverse variations] ====="
      bgps.each {|bgp| p bgp}
    end

    bgps
  end

  def each_solution
    @bgps.each do |bgp|
      sparql = compose_sparql(bgp, @pgp)
      if @debug
        puts "#{sparql}\n++++++++++"
      end
      begin
        result = @endpoint.query(sparql)
      rescue => detail
        if @debug
          p detail
          puts "==========\n"
        end
        sleep(2)
        next
        # print detail.backtrace.join("\n")
      end
      result.each_solution do |solution|
        yield(solution)
      end
      if @debug
        puts "==========\n"
      end
      sleep(2)
    end
  end

  def queries
    @bgps.map {|bgp| {bgp:bgp, sparql:compose_sparql(bgp, @pgp)} }
  end

  def each_sparql_and_solution(proc_solution = nil)
    queries.each do |query|
      if @debug
        puts "#{query[:sparql]}\n++++++++++"
      end

      # 1 / 0
      result = @endpoint.query(query[:sparql])

      if proc_solution
        proc_solution.call(query.merge(solutions: result.map{ |solution| solution.to_h }))
      end

      if @debug
        puts "==========\n"
      end
      sleep(2)
    end
  end

  private

  def generate_split_variations(bgps, max_hop = 2)
    return [] if bgps.empty?

    sbgps = []
    bgps.each do |bgp|
      sortal_tps, non_sortal_tps = bgp.partition{|tp| tp[1].start_with? 's'}
      (1 .. max_hop).to_a.repeated_permutation(non_sortal_tps.length) do |split_scheme|
        split_tps = generate_split_tps(non_sortal_tps, split_scheme)
        sbgps << sortal_tps + split_tps
      end
    end

    sbgps
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
  def generate_inverse_variations (bgps)
    rbgps = []

    bgps.each do |bgp|
      sortal_tps, non_sortal_tps = bgp.partition{|tp| tp[1].start_with? 's'}

      [false, true].repeated_permutation(non_sortal_tps.length) do |inverse_scheme|
        rbgps << sortal_tps + non_sortal_tps.map.with_index {|tp, i| inverse_scheme[i]? tp.reverse : tp}
      end
    end

    rbgps
  end

  # make variations by instantiating terms
  def generate_instantiation_variations(pgp)
    iids = {}
    pgp[:nodes].each do |id, node|
      iid = class?(node[:term]) ? 'i' + id : nil
      iids[id] = iid unless iid.nil?
    end

    connections = pgp[:edges]
    return [] if connections.empty?
    bgp = connections.map.with_index{|c, i| [c['subject'], "p#{i+1}", c['object']]}

    # instantiated BGPs
    ibgps = []
    bgps = [bgp]
    [false, true].repeated_permutation(iids.keys.length) do |instantiate_scheme|
      # id of the terms to be instantiated
      itids = iids.keys.keep_if.with_index{|t, i| instantiate_scheme[i]}
      next unless itids.include?(pgp[:focus])

      if bgps.empty? && !itids.empty?
        ibgp = itids.collect{|t| [iids[t], 's' + t, t]}
        ibgps << ibgp
      else
        bgps.each do |bgp|
          # initialize the instantiated bgp with the triple patterns for term instantiation
          ibgp = itids.collect{|t| [iids[t], 's' + t, t]}

          # add update triples
          bgp.each{|tp| ibgp << tp.map{|e| itids.include?(e)? iids[e] : e}}

          ibgps << ibgp
        end
      end
    end

    ibgps
  end

  def uri?(term)
    term.start_with? 'http://'
  end

  def class?(term)
    if /^http:/.match(term)
      sparql  = "SELECT ?p\n"
      sparql += "FROM <#{@graph_uri}>\n"  unless @graph_uri.nil? || @graph_uri.empty?
      sparql += "WHERE {?s ?p <#{term}> FILTER (str(?p) IN (#{@sortal_predicates.map{|s| '"'+s+'"'}.join(', ')}))} LIMIT 1"
      result = @endpoint.query(sparql)
      return true if result.length > 0
    end
    return false
  end

  def compose_sparql(bgp, pgp)
    nodes = pgp[:nodes]

    # get the variables
    variables = bgp.flatten.uniq - nodes.keys

    # initialize the query
    query  = "SELECT #{variables.map{|v| '?' + v.to_s}.join(' ')}\n"
    query += "FROM <#{@graph_uri}>\n"  unless @graph_uri.nil? || @graph_uri.empty?
    query += "WHERE {"

    # stringify the bgp
    query += bgp.map{|tp| tp.map{|e| nodes.has_key?(e)? "<#{nodes[e][:term]}>" : '?' + e}.join(' ')}.join(' . ') + ' .'

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
    query += "} LIMIT 10"
  end

  def stringify_term (t)
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
