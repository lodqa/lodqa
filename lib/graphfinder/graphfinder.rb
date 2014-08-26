#!/usr/bin/env ruby
#
# It takes two entities as inut and find the predicate sequences connecting them.
#
require 'json'
require 'sparql/client'

class GraphFinder
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

  # This constructor takes the URL of an end point to be searched
  # optionally options can be passed to the server of the end point.
  def initialize (ep_url, ep_options = {})
    @endpoint = SPARQL::Client.new(ep_url, ep_options)
  end

  # It searchs for graphs that match the pgp, pseudo graph pattern.
  # The option _max_hop_ specifies the maximum number of hops to be searched.
  def search_graph (pgp, max_hop = 1)
    bgps = generate_split_variations(pgp[:edges], max_hop)
    bgps.each {|bgp| p bgp}
    p "-=-=-=-"
    bgps = generate_inversed_variations(bgps)
    bgps.each {|bgp| p bgp}
    p "-=-=-=-"
    bgps = generate_instantiated_variations(bgps, pgp)
    bgps.each {|bgp| p bgp}
    p "-=-=-=-"


    bgps.each do |bgp|
      sparql = compose_sparql(bgp, pgp)
      puts "#{sparql}\n++++++++++"
      begin
        result = @endpoint.query(sparql)
      rescue => detail
        p detail
        puts "==========\n"
        sleep(2)
        next
        # print detail.backtrace.join("\n")
      end 
      result.each_solution do |solution|
        puts solution.inspect
      end
      puts "==========\n"
      sleep(2)
    end
  end

  private

  def generate_split_variations(connections, max_hop)
    bgps = []

    # split and make bgps
    split_scheme = []
    (1 .. max_hop).collect{|e| e}.repeated_permutation(connections.length) do |split_scheme|
      bgps << generate_split_bgp(connections, split_scheme)
    end

    bgps
  end

  def generate_split_bgp(connections, split_scheme)
    bgp = []
    connections.each_with_index do |c, i|
      x_variables = (1 ... split_scheme[i]).collect{|j| ("x#{i}#{j}").to_s}
      p_variables = (1 .. split_scheme[i]).collect{|j| ("p#{i}#{j}").to_s}

      # terms including x_variables and the initial and the final terms
      terms = [c[:subject], x_variables, c[:object]].flatten

      # triple patterns
      tps = (0 ... p_variables.length).collect{|i| [terms[i], p_variables[i], terms[i + 1]]}
      bgp += tps
    end
    bgp
  end

  # make variations by inversing each triple pattern
  def generate_inversed_variations (bgps)
    rbgps = []

    bgps.each do |bgp|
      [false, true].repeated_permutation(bgp.length) do |inverse_scheme|
        rbgps << bgp.map.with_index {|tp, i| inverse_scheme[i]? tp.reverse : tp}
      end
    end

    rbgps
  end

  # make variations by instantiating terms
  def generate_instantiated_variations(bgps, pgp)
    iid = {}
    pgp[:nodes].each do |n|
      r = generate_instance_id_if_applicable(n)
      iid[n[:id]] = r unless r == nil
    end

    ibgps = []
    bgps.each do |bgp|
      [false, true].repeated_permutation(iid.keys.length) do |instantiate_scheme|
        # id of the terms to be instantiated
        itids = iid.keys.keep_if.with_index{|t, i| instantiate_scheme[i]}

        # initialize the instantiated bgp with the triple patterns for term instantiation
        ibgp = itids.collect{|t| [iid[t], 's' + t, t]}

        # add update triples
        bgp.each{|tp| ibgp << tp.map{|e| itids.include?(e)? iid[e] : e}}

        ibgps << ibgp
      end
    end

    ibgps
  end

  def generate_instance_id_if_applicable (node)
    class_p(node[:term])? 'i' + node[:id] : nil
  end

  def class_p (term)
    if /^<.+>$/.match(term)
      sparql = "SELECT ?p WHERE {?s ?p #{term} FILTER (str(?p) IN (#{SORTAL_PREDICATES.map{|s| '"'+s+'"'}.join(', ')}))} LIMIT 1"
      result = @endpoint.query(sparql)
      return true if result.length > 0
    end
    return false
  end

  def compose_sparql(bgp, pgp)
    # index the terms
    tidx = {}
    pgp[:nodes].each{|n| tidx[n[:id]] = n[:term]}

    # get the variables
    variables = bgp.flatten.uniq - tidx.keys

    # initialize the query
    query = "SELECT #{variables.map{|v| '?' + v.to_s}.join(' ')} WHERE {"

    # stringify the bgp
    query += bgp.map{|tp| tp.map{|e| tidx.has_key?(e)? tidx[e] : '?' + e}.join(' ')}.join(' . ') + ' .'

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
    ex_predicates += IGNORE_PREDICATES

    # filter out sotral predicates
    ex_predicates += SORTAL_PREDICATES

    unless ex_predicates.empty?
      p_variables.each {|v| query += %| FILTER (str(?#{v}) NOT IN (#{ex_predicates.map{|s| '"'+s+'"'}.join(', ')}))|}
    end

    ## constraintes on s-variables
    s_variables = variables.dup.keep_if{|v| v[0] == 's'}

    # s-variables to be bound to sortal predicates
    s_variables.each {|v| query += %| FILTER (str(?#{v}) IN (#{SORTAL_PREDICATES.map{|s| '"'+s+'"'}.join(', ')}))|}

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
  gf = GraphFinder.new(EP_URL, {:method => :get, :read_timeout => 600})

  # EP_URL = "http://dbpedia.org/sparql/"
  # gf = GraphFinder.new(EP_URL)
  # what genes are related to alzheimer?
  # ((w, "genes"), (w, "alzheimer"))
  # what genes are related to the deseases that are connected to memory problem?
  # ((w, :a, "genes"), (w, "related", "diseases"), ("diseases", "connected", "memory problem"))


  # EP_URL = "http://omim.bio2rdf.org/sparql/"
  # gf = GraphFinder.new(EP_URL)

  query_json = File.read (ARGV[0])
  query_graph = JSON.parse query_json, :symbolize_names => true

  gf.search_graph(query_graph, ARGV[1].to_i)
  # gf.shortestPaths(ARGV[0], ARGV[1])
  # gf.shortestPaths("http://dbpedia.org/resource/SAHSA", "http://dbpedia.org/resource/Honolulu_International_Airport")
end
