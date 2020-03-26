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

      def sparqls_count pgp, mappings, endpoint_url, endpoint_options, graph_uri, graph_finder_options
        url = "#{ENV['LODQA_BS']}/sparqls_counts"
        payload = {
          pgp: pgp.to_json,
          mappings: mappings.to_json,
          endpoint_url: endpoint_url,
          endpoint_options: endpoint_options.to_json,
          graph_uri: graph_uri,
          graph_finder_options: graph_finder_options.to_json
        }

        begin
          response = RestClient::Request.execute method: :get, url: url, payload: payload
          JSON.parse(response.body)['sparqls_count']
    		rescue Errno::ECONNREFUSED, Net::OpenTimeout, SocketError => e
    			Logger::Logger.error e
    		end
      end

      private

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
