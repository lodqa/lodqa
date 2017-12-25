require 'lodqa'
require 'lodqa/graph_finder'
require 'lodqa/logger'
require 'lodqa/term_finder'

module Lodqa
  module OneByOneExecutor
    class << self
      def search_query(ws, applicant, default_parse_url, query, read_timeout)
        begin
          # Prepare to cancel
          request_id = Logger.request_id
          cancel_flag = false
          ws.onclose do
            Logger.request_id = request_id
            Logger.debug 'The WebSocket connection is closed.'
            cancel_flag = true
          end

          ws.send({event: :datasets, dataset: applicant[:name]}.to_json)

          # pgp
          pgp = pgp(applicant[:parser_url] || default_parse_url, query)
          ws.send({event: :pgp, dataset: applicant[:name], pgp: pgp}.to_json)

          # mappings
          mappings = mappings(applicant[:dictionary_url], pgp)
          ws.send({event: :mappings, dataset: applicant[:name], pgp: pgp, mappings: mappings}.to_json)

          #Lodqa(anchored_pgp)
          endpoint_options = {
            read_timeout: read_timeout
          }
          lodqa = Lodqa.new(applicant[:endpoint_url], applicant[:graph_uri], endpoint_options)
          lodqa.pgp = pgp
          lodqa.mappings = mappings

          endpoint = CachedSparqlClient.new(applicant[:endpoint_url], method: :get, read_timeout: read_timeout)
          lodqa.anchored_pgps.each do |anchored_pgp|
            if cancel_flag
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
                if cancel_flag
                  Logger.debug "Stop during processing an bgp: #{bgp}"
                  return
                end

                ws.send({event: :bgp, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp}.to_json)

                query = {bgp: bgp, sparql: graph_finder.compose_sparql(bgp, anchored_pgp)}
                ws.send({event: :sparql, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query}.to_json)

                # Get solutions of SPARQL
                begin
                  solutions = endpoint.query(query[:sparql]).map{ |solution| solution.to_h }
                  ws.send({event: :solutions, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: solutions}.to_json)

                  # Find the answer of the solutions.
                  solutions.each do |solution|
                    solution.each do |node|
                      # The answer is instance node of focus node.
                      if(anchored_pgp[:focus] == node[0].to_s.gsub(/^i/, ''))
                        label = label(endpoint, node)
                        ws.send({event: :answer, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: solutions, solution: solution, answer: node, label: label}.to_json)
                      end
                    end
                  end

                rescue SparqlEndpointTimeoutError => e
                  Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a timeout error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
                  ws.send({event: :solutions, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: [], error: 'sparql timeout error'}.to_json)
                rescue SparqlEndpointTemporaryError => e
                  Logger.debug "The SPARQL Endpoint #{e.endpoint_name} return a temporary error for #{e.sparql}, continue to the next SPARQL", error_message: e.message
                  ws.send({event: :solutions, dataset: applicant[:name], pgp: pgp, mappings: mappings, anchored_pgp: anchored_pgp, bgp: bgp, query: query, solutions: [], errer: 'endopoint temporary error'}.to_json)
                end
              end
            end
          end
        rescue SparqlEndpointError => e
          Logger.debug "The SPARQL Endpoint #{e.endpoint_name} has a persistent error, continue to the next Endpoint", error_message: e.message
        rescue TermFindError => e
          Logger.debug e.message
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

      def label(endpoint, node)
        query_for_solution = "select ?label where { <#{node[1]}>  rdfs:label ?label }"
        endpoint.query(query_for_solution).map{ |s| s.to_h[:label] }.first
      end
    end
  end
end
