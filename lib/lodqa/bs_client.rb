require 'rest_client'
require 'logger/logger'

module Lodqa
  module BSClient
    WEB_SOCKETS = {}

    class << self
      def socket_for request_id
        WEB_SOCKETS[request_id]
      end

      def register_query ws, request_id, query, read_timeout, sparql_limit, answer_limit, target, user_id
        send_bs_error_on ws do
          url = "#{ENV['LODQA_BS']}/searches"
          payload = {
            query: query,
            read_timeout: read_timeout,
            sparql_limit: sparql_limit,
            answer_limit: answer_limit,
            target: target,
            user_id: user_id,
            callback_url: "#{ENV['LODQA']}/requests/#{request_id}/black_hall"
          }.delete_if { |k, v| v.nil? || v.empty? }
          RestClient::Request.execute method: :post, url: url, payload: payload
        end
      end

      def register_pgp_and_mappings ws, request_id, pgp, mappings, read_timeout, sparql_limit, answer_limit, target, user_id
        send_bs_error_on ws do
          url = "#{ENV['LODQA_BS']}/searches"
          payload = {
            pgp: pgp.to_json,
            mappings: mappings.to_json,
            read_timeout: read_timeout,
            sparql_limit: sparql_limit,
            answer_limit: answer_limit,
            target: target,
            user_id: user_id,
            callback_url: "#{ENV['LODQA']}/requests/#{request_id}/black_hall"
          }.delete_if { |k, v| v.nil? || v.empty? }
          RestClient::Request.execute method: :post, url: url, payload: payload
        end
      end

      def subscribe ws, request_id, url, mode
        WEB_SOCKETS[request_id] = ws
        ws.on(:close) { WEB_SOCKETS.delete request_id }

        send_bs_error_on ws do
          payload = {
            callback_url: "#{ENV['LODQA']}/requests/#{request_id}/#{mode}/events"
          }

          RestClient::Request.execute method: :post, url: url, payload: payload
        end
      end

      def sparqls pgp, mappings, graph_finder, enum
        anchored_pgps(pgp, mappings).each do |anchored_pgp|
          to_sparql(anchored_pgp, graph_finder){ |sparql| enum << sparql}
        end
      end

      private

      def anchored_pgps pgp, mappings
        Logger::Logger.debug "start #{self.class.name}##{__method__}"

        anchored_pgps = []
        pgp[:nodes].delete_if{|n| nodes_to_delete(pgp, mappings).include? n}
        pgp[:edges].uniq!
        terms = pgp[:nodes].values.map{|n| mappings[n[:text].to_sym]}

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

        anchored_pgps
      end

      def to_sparql(anchored_pgp, graph_finder)
        Logger::Logger.debug "create graph finder"

        graph_finder.sparqls_of(anchored_pgp) do |bgp, sparql|
          yield sparql
        end
      end

      def nodes_to_delete pgp, mappings
        Logger::Logger.debug "start #{self.class.name}##{__method__}"

        nodes_to_delete = []
        pgp[:nodes].each_key do |n|
          if mappings[pgp[:nodes][n][:text]].nil? || mappings[pgp[:nodes][n][:text]].empty?
            connected_nodes = []
            pgp[:edges].each{|e| connected_nodes << e[:object] if e[:subject] == n}
            pgp[:edges].each{|e| connected_nodes << e[:subject] if e[:object] == n}

            # if it is a passing node
            if connected_nodes.length == 2
              nodes_to_delete << n
              pgp[:edges].each do |e|
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

      def send_bs_error_on ws
        yield
      rescue RestClient::NotFound
        ws.send({ event: :bs_error, error_message: 'No runnnig qurey was found' }.to_json)
        nil
      rescue Errno::ECONNREFUSED, SocketError
        ws.send({ event: :bs_error, error_message: 'LODQA bot server error' }.to_json)
        nil
      end
    end
  end
end
