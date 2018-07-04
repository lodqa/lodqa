#!/usr/bin/env ruby
require 'net/http'
require 'json'
require 'enju_access/cgi_accessor'
require 'logger/logger'
require 'sparql_client/cacheable_client'
require 'lodqa/graph_finder'
require 'logger/logger'
require 'lodqa/sources'
require 'lodqa/pgp_factory'
require 'lodqa/configuration'

module Lodqa
  class Lodqa
    attr_reader   :parse_rendering
    attr_accessor :pgp
    attr_accessor :mappings

    attr_reader :endpoint

    def initialize(ep_url, graph_uri, endpoint_options)
      @endpoint = SparqlClient::CacheableClient.new(ep_url, endpoint_options)
      @graph_uri = graph_uri
    end

    # Return an enumerator to speed up checking the existence of sparqls.
    def sparqls(graph_finder_options)
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      Enumerator.new do |y|
        begin
          anchored_pgps.each do |anchored_pgp|
            to_sparql(anchored_pgp, graph_finder_options){ |sparql| y << sparql}
          end
        rescue SparqlClient::EndpointError => e
          Logger::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} has a persistent error, continue to the next Endpoint", error_message: e.message
        end
      end
    end

    def each_anchored_pgp_and_sparql_and_solution(proc_anchored_pgp, proc_solution, graph_finder_options)
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      if @cancel_flag
        Logger::Logger.debug "Stop before processing anchored_pgps"
        return
      end

      anchored_pgps.each do |anchored_pgp|
        if @cancel_flag
          Logger::Logger.debug "Stop during processing an anchored_pgp: #{anchored_pgp}"
          return
        end

        proc_anchored_pgp.call(anchored_pgp)

        Logger::Logger.debug "Query sparqls for anchored_pgp: #{anchored_pgp}"

        graph_finder = GraphFinder.new(@endpoint, @graph_uri, graph_finder_options)
        graph_finder.sparqls_of(anchored_pgp) do |bgp, sparql|
          query_sparql @endpoint, bgp, sparql, proc_solution
        end

        Logger::Logger.debug "Finish anchored_pgp: #{anchored_pgp}"
      end
    end

    def dispose(request_id)
      Logger::Logger.debug "Cancel query for pgp: #{@pgp}", request_id
      @cancel_flag = true
    end

    def anchored_pgps
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      Enumerator.new do |anchored_pgps|
        @pgp[:nodes].delete_if{|n| nodes_to_delete.include? n}
        @pgp[:edges].uniq!
        terms = @pgp[:nodes].values.map{|n| @mappings[n[:text].to_sym]}

        terms.map!{|t| t.nil? ? [] : t}

        Logger::Logger.debug "terms: #{ terms.first.product(*terms.drop(1)) }"

        terms.first.product(*terms.drop(1))
          .each do |ts|
            anchored_pgp = pgp.dup
            anchored_pgp[:nodes] = pgp[:nodes].dup
            anchored_pgp[:nodes].each_key{|k| anchored_pgp[:nodes][k] = pgp[:nodes][k].dup}
            anchored_pgp[:nodes].each_value.with_index{|n, i| n[:term] = ts[i]}

            anchored_pgps << anchored_pgp
          end
      end
    end

    private

    def to_sparql(anchored_pgp, graph_finder_options)
      if @cancel_flag
        Logger::Logger.debug "Stop during creating SPARQLs for anchored_pgp: #{anchored_pgp}"
        return
      end

      Logger::Logger.debug "create graph finder"
      graph_finder = GraphFinder.new(@endpoint, @graph_uri, graph_finder_options)

      if @cancel_flag
        Logger::Logger.debug "Stop during creating SPARQLs for anchored_pgp: #{anchored_pgp}"
        return
      end

      Logger::Logger.debug "return SPARQLs of bgps"
      graph_finder.sparqls_of(anchored_pgp) do |bgp, sparql|
        yield sparql
      end
    end

    def query_sparql(endpoint, bgp, sparql, proc_solution)
      Logger::Logger.debug "#{sparql}\n++++++++++"

      begin
        result = endpoint.query(sparql)
        proc_solution.call bgp: bgp,
                           sparql: sparql,
                           solutions: result.map{ |s| s.to_h }

      rescue EndpointTimeoutError => e
        Logger::Logger.debug "The SPARQL Endpoint returns a timeout error, continue to the next SPARQL",
                     error_message: e.message,
                     Endpoint: e.endpoint_name,
                     SPARQL: sparql

        # Send back error
        proc_solution.call({bgp: bgp, sparql: sparql, sparql_timeout: {error_message: e}, solutions: []})

      rescue EndpointTemporaryError => e
        Logger::Logger.debug "The SPARQL Endpoint returns a temporary error, continue to the next SPARQL",
                     error_message: e.message,
                     Endpoint: e.endpoint_name,
                     SPARQL: sparql

        # Send back error
        proc_solution.call({bgp: bgp, sparql: sparql, sparql_timeout: {error_message: e}, solutions: []})

      ensure
        if @cancel_flag
          Logger::Logger.debug "Stop procedure after a sparql query ends"
          return
        end
      end

      Logger::Logger.debug "==========\n"

      # TODO http://rdf.pubannotation.org/sparql requires 2 seconds wait ?
      # sleep 2
    end

    def nodes_to_delete
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      nodes_to_delete = []
      @pgp[:nodes].each_key do |n|
        if @mappings[@pgp[:nodes][n][:text]].nil? || @mappings[@pgp[:nodes][n][:text]].empty?
          connected_nodes = []
          @pgp[:edges].each{|e| connected_nodes << e[:object] if e[:subject] == n}
          @pgp[:edges].each{|e| connected_nodes << e[:subject] if e[:object] == n}

          # if it is a passing node
          if connected_nodes.length == 2
            nodes_to_delete << n
            @pgp[:edges].each do |e|
              e[:object]  = connected_nodes[1] if e[:subject] == connected_nodes[0] && e[:object]  == n
              e[:subject] = connected_nodes[1] if e[:subject] == n && e[:object]  == connected_nodes[0]
              e[:object]  = connected_nodes[0] if e[:subject] == connected_nodes[1] && e[:object]  == n
              e[:subject] = connected_nodes[0] if e[:subject] == n && e[:object]  == connected_nodes[1]
            end
          end
        end
      end
      nodes_to_delete
    end
  end

  if __FILE__ == $0
    # default values
    config_file = 'config/qald-biomed.yml'
    maxhop = 2
    query = nil
    debug = false

    ## command line option processing
    require 'optparse'
    optparse = OptionParser.new do |opts|
      opts.banner = "Usage: lodqa.rb [options]"

      opts.on('-c', '--configuration filename', "specifies configuration file (default = '#{config_file}')") do |f|
        config_file = f
      end

      opts.on('-m', '--maxhop number', "specifies the number of maximum hops to investigate (default = '#{maxhop}')") do |n|
        maxhop = n.to_i
      end

      opts.on('-q', '--query query', "gives the query to process.") do |q|
        query = q.chomp
      end

      opts.on('-d', '--debug', "tells it to be verbose.") do |q|
        debug = true
      end

      opts.on('-h', '--help', 'displays this screen') do
        puts opts
        exit
      end
    end

    optparse.parse!

    ## configuration
    require 'app_config'
    AppConfig.setup!(yaml: config_file)
    endpoint_url      = AppConfig.endpoint_url
    ignore_predicates = AppConfig.ignore_predicates
    sortal_predicates = AppConfig.sortal_predicates
    parser_url        = AppConfig.parser_url
    dictionary_url    = AppConfig.dictionary_url
    query             = AppConfig.query if query.nil?

    ## query from the command line
    query = ARGV[0] unless ARGV[0].nil?

    # puts "[SPARQL Endpoint] #{endpoint_url}"
    # puts "[dictionary URL] #{dictionary_url}"
    # puts "[Maximum number of hops] #{maxhop}"

    lodqa = Lodqa.new(query, parser_url, dictionary_url, endpoint_url, {})
    # lodqa.find_answer

    proc_anchored_pgp = Proc.new do |anchored_pgp|
      puts "================="
      p anchored_pgp
    end

    proc_solution = Proc.new do |solution|
      # target = if solution[('i' + focus).to_sym].nil?
      #   focus.to_sym
      # else
      #   ('i' + focus).to_sym
      # end
      # puts solution[target]
      # puts '-----'
      # p solution.keys
      p solution
    end

    lodqa.each_anchored_pgp_and_solution(proc_anchored_pgp, proc_solution, {:ignore_predicates => ignore_predicates, :sortal_predicates => sortal_predicates})
    # lodqa.each_anchored_pgp_and_solution(nil, proc_solution)
  end
end
