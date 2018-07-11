require 'logger/logger'
require 'term/finder'
require 'lodqa/lodqa'
require 'lodqa/graph_finder'

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
      @event_hadlers[event]&.each { |h| h.call(event, data) }
    end

    def search_query(applicant, default_parse_url, query, read_timeout, url_forwading_db)
      begin
        emit :datasets, dataset: applicant[:name]

        # pgp
        pgp = pgp(applicant[:parser_url] || default_parse_url, query)
        emit :pgp, dataset: applicant[:name], pgp: pgp

        # mappings
        mappings = mappings(applicant[:dictionary_url], pgp)
        emit :mappings, dataset: applicant[:name], pgp: pgp, mappings: mappings

        #Lodqa(anchored_pgp)
        endpoint_options = {
          read_timeout: read_timeout
        }
        graph_finder_options = {
          max_hop: applicant[:max_hop],
          ignore_predicates: applicant[:ignore_predicates],
          sortal_predicates: applicant[:sortal_predicates]
        }
        lodqa = Lodqa.new applicant[:endpoint_url],
                          endpoint_options,
                          applicant[:graph_uri],
                          graph_finder_options
        lodqa.pgp = pgp
        lodqa.mappings = mappings

        endpoint = SparqlClient::CacheableClient.new(applicant[:endpoint_url], method: :get, read_timeout: read_timeout)

        parallel = 16
        start = Time.now
        count, error, success = 0, 0, 0
        queue = Queue.new # すべてのSPARQL検索が終わるのを待ち合わせる
        known_sparql = Set.new # 重複したSPARQLを生成したら検索をスキップする

        lodqa.anchored_pgps.each do |anchored_pgp|
          if @cancel_flag
            Logger::Logger.debug "Stop during processing an anchored_pgp: #{anchored_pgp}"
            return
          end

          #GraphFinder(bgb)
          graph_finder = GraphFinder.new(endpoint, nil, graph_finder_options)
          graph_finder.sparqls_of anchored_pgp do |bgp, sparql|
            if @cancel_flag
              Logger::Logger.debug "Stop during processing an bgp: #{bgp}"
              return
            end

            # Skip querying duplicated SPARQL.
            next if known_sparql.member? sparql
            known_sparql << sparql

            emit :sparql, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql

            # Get solutions of SPARQL
            get_solutions_of_sparql_async endpoint, applicant, pgp, mappings, anchored_pgp, bgp, sparql, url_forwading_db, queue

            # Emit an event to notify starting of querying the SPARQL.
            emit :query_sparql, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql
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

        if (error + success) > 0
          stats = {
            parallel: parallel,
            duration: Time.now - start,
            sparqls: error + success,
            error: error,
            success: success,
            error_rate: error/(error + success).to_f
          }

          Logger::Logger.info "Finish stats: #{stats}"
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
      rescue => e
        Logger::Logger.error e
      end
    end

    private

    def get_solutions_of_sparql_async(endpoint, applicant, pgp, mappings, anchored_pgp, bgp, sparql, url_forwading_db, queue)
      # Get solutions of SPARQL
      endpoint.query_async(sparql) do |e, result|
        case e
        when nil
          solutions = result.map{ |solution| solution.to_h }

          emit :solutions, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: solutions

          # Find the answer of the solutions.
          solutions.each do |solution|
            solution
              .select { |id| anchored_pgp[:focus] == id.to_s.gsub(/^i/, '') } # The answer is instance node of focus node.
              .each { |_, uri| get_label_of_url endpoint, applicant, pgp, mappings, anchored_pgp, bgp, sparql, solutions, solution, uri, url_forwading_db }
          end
        when SparqlClient::EndpointTimeoutError
          Logger::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a timeout error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
          emit :solutions,
                dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: [],
                error: 'sparql timeout error'
        when SparqlClient::EndpointTemporaryError
          Logger::Logger.info "The SPARQL Endpoint #{e.endpoint_name} return a temporary error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
          emit :solutions,
               dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: [],
               error_message: 'endopoint temporary error'
        else
          Logger::Logger.error e
        end

        queue.push [e, result]
      end
    end

    def get_label_of_url(endpoint, applicant, pgp, mappings, anchored_pgp, bgp, sparql, solutions, solution, uri, url_forwading_db)
      # WebSocket message will be disorderd if additional informations are get ascynchronously
      label = label(endpoint, uri)
      urls, first_rendering = forwarded_urls(uri, url_forwading_db)

      emit :answer,
           dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, sparql: sparql, solutions: solutions,
           solution: solution,
           answer: { uri: uri, label: label, urls: urls&.select{ |u| u[:forwarding][:url].length < 10000 }, first_rendering: first_rendering }
    end

    def pgp(parser_url, query)
      PGPFactory.create parser_url, query
    end

    def mappings(dictionary_url, pgp)
      tf = Term::Finder.new(dictionary_url)
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
      Logger::Logger.debug "Failed to conntect The URL forwarding DB at #{url_forwading_db}, continue to the next SPARQL", error_message: e.message
      nil
    end
  end
end
