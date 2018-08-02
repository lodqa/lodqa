# frozen_string_literal: true

require 'logger/logger'
require 'term/finder'
require 'lodqa/lodqa'
require 'lodqa/graph_finder'

module Lodqa
  class OneByOneExecutor
    attr_accessor :cancel_flag

    def initialize dataset, query,
                   parser_url: 'http://enju-gtrec.dbcls.jp',
                   urilinks_url: 'http://urilinks.lodqa.org',
                   read_timeout: 5,
                   debug: false

      @target_dataset = dataset
      @query = query
      @default_parser_url = parser_url
      @urilinks_url = urilinks_url
      @read_timeout = read_timeout

      Logger::Logger.level = debug ? Logger::DEBUG : Logger::INFO

      # Flag to stop search
      @cancel_flag = false

      # For event emitting
      @event_hadlers = {}
      @event_data = {}
    end

    # Bind event handler to events
    def on *events, &block
      return unless events.is_a? Array
      events.each do |e|
        @event_hadlers[e] = [] unless @event_hadlers[e]
        @event_hadlers[e].push(block)
      end
    end

    # Merage previouse event data and call all event handlers.
    def emit event, data
      @event_hadlers[event]&.each { |h| h.call(event, data) }
    end

    def perform
      emit :datasets, dataset: @target_dataset[:name]

      # pgp
      emit :pgp, dataset: @target_dataset[:name], pgp: pgp

      # mappings
      mappings = mappings(@target_dataset[:dictionary_url], pgp)
      emit :mappings, dataset: @target_dataset[:name], pgp: pgp, mappings: mappings

      # Lodqa(anchored_pgp)
      endpoint_options = {
        read_timeout: @read_timeout
      }
      graph_finder_options = {
        max_hop: @target_dataset[:max_hop],
        ignore_predicates: @target_dataset[:ignore_predicates],
        sortal_predicates: @target_dataset[:sortal_predicates]
      }
      lodqa = Lodqa.new @target_dataset[:endpoint_url],
                        endpoint_options,
                        @target_dataset[:graph_uri],
                        graph_finder_options
      lodqa.pgp = pgp
      lodqa.mappings = mappings

      endpoint = SparqlClient::CacheableClient.new(@target_dataset[:endpoint_url], method: :get, read_timeout: @read_timeout)

      parallel = 16
      start = Time.now
      count = 0
      error = 0
      success = 0
      queue = Queue.new # Wait finishing serach of all SPARQLs.
      known_sparql = Set.new # Skip serach when SPARQL is duplicated.

      lodqa.anchored_pgps.each do |anchored_pgp|
        if @cancel_flag
          Logger::Logger.debug "Stop during processing an anchored_pgp: #{anchored_pgp}"
          return
        end

        # GraphFinder(bgb)
        graph_finder = GraphFinder.new(endpoint, nil, graph_finder_options)
        graph_finder.sparqls_of anchored_pgp do |bgp, sparql|
          if @cancel_flag
            Logger::Logger.debug "Stop during processing an bgp: #{bgp}"
            return
          end

          # Skip querying duplicated SPARQL.
          next if known_sparql.member? sparql
          known_sparql << sparql

          emit :sparql, dataset: @target_dataset[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql

          # Get solutions of SPARQL
          get_solutions_of_sparql_async endpoint, pgp, mappings, anchored_pgp, bgp, sparql, queue

          # Emit an event to notify starting of querying the SPARQL.
          emit :query_sparql, dataset: @target_dataset[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql
          count += 1

          if count >= parallel
            e, s = queue.pop
            error += 1 if e
            success += 1 if s
            count -= 1
          end
        end
      end

      count.times do
        e, s = queue.pop
        error += 1 if e
        success += 1 if s
      end

      if (error + success).positive?
        stats = {
          parallel: parallel,
          duration: Time.now - start,
          dataset: @target_dataset[:name],
          sparqls: error + success,
          error: error,
          success: success,
          error_rate: error / (error + success).to_f
        }

        Logger::Logger.info "Finish stats: #{JSON.pretty_generate stats}"
      end
    rescue EnjuAccess::EnjuError => e
      Logger::Logger.debug e.message
      emit :gateway_error,
           error_message: 'enju access error'
    rescue Term::FindError => e
      Logger::Logger.debug e.message
      emit :gateway_error,
           error_message: 'dictionary lookup error'
    rescue SparqlClient::EndpointError => e
      Logger::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} has a persistent error, continue to the next Endpoint", error_message: e.message
    rescue StandardError => e
      Logger::Logger.error e
    end

    private

    def get_solutions_of_sparql_async endpoint, pgp, mappings, anchored_pgp, bgp, sparql, queue
      # Get solutions of SPARQL
      endpoint.query_async(sparql) do |e, result|
        case e
        when nil
          solutions = result.map(&:to_h)

          emit :solutions, dataset: @target_dataset[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: solutions

          # Find the answer of the solutions.
          solutions.each do |solution|
            solution
              .select { |id| anchored_pgp[:focus] == id.to_s.gsub(/^i/, '') } # The answer is instance node of focus node.
              .each { |_, uri| get_label_of_url endpoint, pgp, mappings, anchored_pgp, bgp, sparql, solutions, solution, uri }
          end
        when SparqlClient::EndpointTimeoutError
          Logger::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a timeout error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
          emit :solutions,
               dataset: @target_dataset[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: [],
               error: 'sparql timeout error'
        when SparqlClient::EndpointTemporaryError
          Logger::Logger.info "The SPARQL Endpoint #{e.endpoint_name} return a temporary error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
          emit :solutions,
               dataset: @target_dataset[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: [],
               error_message: 'endopoint temporary error'
        else
          Logger::Logger.error e
        end

        queue.push [e, result]
      end
    end

    def get_label_of_url endpoint, pgp, mappings, anchored_pgp, bgp, sparql, solutions, solution, uri
      # WebSocket message will be disorderd if additional informations are get ascynchronously
      label = label(endpoint, uri)
      urls, first_rendering = forwarded_urls(uri)

      emit :answer,
           dataset: @target_dataset[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: solutions,
           solution: solution,
           answer: { uri: uri, label: label, urls: urls&.select { |u| u[:forwarding][:url].length < 10_000 }, first_rendering: first_rendering }
    end

    def pgp
      @pgp ||= PGPFactory.create (@target_dataset[:parser_url] || @default_parser_url),
                                 @query
    end

    def mappings dictionary_url, pgp
      tf = Term::Finder.new(dictionary_url)
      keywords = pgp[:nodes].values.map { |n| n[:text] }.concat(pgp[:edges].map { |e| e[:text] })
      tf.find(keywords)
    end

    def label endpoint, uri
      query_for_solution = "select ?label where { <#{uri}>  rdfs:label ?label }"
      endpoint.query(query_for_solution).map { |s| s.to_h[:label] }.first
    end

    def forwarded_urls uri
      urls = RestClient.get("#{@urilinks_url}/url/translate.json?query=#{uri}") do |res|
        return nil unless res.code == 200

        JSON.parse(res.body, symbolize_names: true)[:results]
            .sort_by { |m| [- m[:matching_score], - m[:priority]] }
      end

      first_rendering = urls.find { |u| u.dig(:rendering, :mime_type)&.start_with? 'image' }&.dig(:rendering)
      [urls, first_rendering]
    rescue Errno::ECONNREFUSED => e
      Logger::Logger.debug "Failed to conntect The URL forwarding DB at #{@urilinks_url}, continue to the next SPARQL", error_message: e.message
      nil
    end
  end
end
