require 'lodqa'
require 'lodqa/graph_finder'
require 'lodqa/logger'
require 'lodqa/term_finder'

module Lodqa
  class OneByOneExecutor
    attr_accessor :cancel_flag

    def initialize
      @cancel_flag = false
      @event_hadlers = {}
      @event_data = {}
    end

    # Bind event handler to events
    def on(*events, &block)
      if events.kind_of? Array
        events.each do |e|
          @event_hadlers[e] = [] unless @event_hadlers[e]
          @event_hadlers[e].push(block)
        end
      end
    end

    # Merage previouse event data and call all event handlers.
    def emit(event, data)
      # Delete event data after bgp, because events after bgp event are occurred repeatedly.
      [:query, :solutions, :solution, :answer, :error].each { |key| @event_data.delete key } if event == :bgp

      @event_data = @event_data.merge data
      @event_hadlers[event]&.each { |h| h.call(event, @event_data) }
    end

    def search_query(applicant, default_parse_url, query, read_timeout, url_forwading_db)
      begin
        emit :datasets, dataset: applicant[:name]

        # pgp
        pgp = pgp(applicant[:parser_url] || default_parse_url, query)
        emit :pgp, pgp: pgp

        # mappings
        mappings = mappings(applicant[:dictionary_url], pgp)
        emit :mappings, mappings: mappings

        #Lodqa(anchored_pgp)
        endpoint_options = {
          read_timeout: read_timeout
        }
        lodqa = Lodqa.new(applicant[:endpoint_url], applicant[:graph_uri], endpoint_options)
        lodqa.pgp = pgp
        lodqa.mappings = mappings

        endpoint = CachedSparqlClient.new(applicant[:endpoint_url], method: :get, read_timeout: read_timeout)
        lodqa.anchored_pgps.each do |anchored_pgp|
          if @cancel_flag
            Logger.debug "Stop during processing an anchored_pgp: #{anchored_pgp}"
            return
          end

          #GraphFinder(bgb)
          graph_finder_options = {
            max_hop: applicant[:max_hop],
            ignore_predicates: applicant[:ignore_predicates],
            sortal_predicates: applicant[:sortal_predicates]
          }
          graph_finder = GraphFinder.new(anchored_pgp, endpoint, nil, graph_finder_options)
          bgps = graph_finder.bgps

          if bgps.any?
            #SPARQL
            bgps.each do |bgp|
              if @cancel_flag
                Logger.debug "Stop during processing an bgp: #{bgp}"
                return
              end

              emit :bgp, anchored_pgp: anchored_pgp, bgp: bgp

              query = {bgp: bgp, sparql: graph_finder.compose_sparql(bgp, anchored_pgp)}
              emit :sparql, query: query

              # Get solutions of SPARQL
              begin
                solutions = endpoint.query(query[:sparql]).map{ |solution| solution.to_h }
                emit :solutions, solutions: solutions

                # Find the answer of the solutions.
                solutions.each do |solution|
                  solution
                    .select do |id|
                      # The answer is instance node of focus node.
                      anchored_pgp[:focus] == id.to_s.gsub(/^i/, '')
                    end
                    .each do |id, uri|
                      # WebSocket message will be disorderd if additional informations are get ascynchronously
                      label = label(endpoint, uri)
                      urls, first_rendering = forwarded_urls(uri, url_forwading_db)

                      emit :answer,
                           solution: solution,
                           answer: { uri: uri, label: label, urls: urls&.select{ |u| u[:forwarding][:url].length < 10000 }, first_rendering: first_rendering }
                    end
                end

              rescue SparqlEndpointTimeoutError => e
                Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a timeout error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
                emit :solutions,
                      solutions: [],
                      error: 'sparql timeout error'
              rescue SparqlEndpointTemporaryError => e
                Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a temporary error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
                emit :solutions,
                     solutions: [],
                     error_message: 'endopoint temporary error'
              end
            end
          end
        end
      rescue EnjuAccess::EnjuError => e
        Logger.debug e.message
        emit :gateway_error,
             error_message: 'enju access error'
      rescue TermFindError => e
        Logger.debug e.message
        emit :gateway_error,
             error_message: 'dictionary lookup error'
      rescue SparqlEndpointError => e
        Logger.debug "The SPARQL Endpoint #{e.endpoint_name} has a persistent error, continue to the next Endpoint", error_message: e.message
      rescue => e
        Logger.error e
      end
    end

    private

    def pgp(parser_url, query)
      PGPFactory.create parser_url, query
    end

    def mappings(dictionary_url, pgp)
      tf = TermFinder.new(dictionary_url)
      keywords = pgp[:nodes].values.map{|n| n[:text]}.concat(pgp[:edges].map{|e| e[:text]})
      tf.find(keywords)
    end

    def label(endpoint, uri)
      query_for_solution = "select ?label where { <#{uri}>  rdfs:label ?label }"
      endpoint.query(query_for_solution).map{ |s| s.to_h[:label] }.first
    end

    def forwarded_urls(uri, url_forwading_db)
      urls = RestClient.get("#{url_forwading_db}/url/translate.json?query=#{uri}") do |res|
        return nil unless res.code == 200

        JSON.parse(res.body, symbolize_names: true)[:results]
          .sort_by{ |m| [- m[:matching_score], - m[:priority]] }
      end

      first_rendering = urls.find{ |u| u.dig(:rendering, :mime_type)&.start_with? 'image' }&.dig(:rendering)
      [urls, first_rendering]
    rescue Errno::ECONNREFUSED => e
      Logger.debug "Failed to conntect The URL forwarding DB at #{url_forwading_db}, continue to the next SPARQL", error_message: e.message
      nil
    end
  end
end
