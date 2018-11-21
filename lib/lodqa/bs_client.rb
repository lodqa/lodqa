require 'rest_client'

module Lodqa
  module BSClient
    WEB_SOCKETS = {}

    class << self
      def socket_for request_id
        WEB_SOCKETS[request_id]
      end

      def register_query ws, request_id, query, read_timeout, sparql_limit, answer_limit, target
        send_bs_error_on ws do
          url = "#{ENV['LODQA_BS']}/searches"
          payload = {
            query: query,
            read_timeout: read_timeout,
            sparql_limit: sparql_limit,
            answer_limit: answer_limit,
            target: target,
            callback_url: "#{ENV['LODQA']}/requests/#{request_id}/hogehoge"
          }.delete_if { |k, v| v.nil? || v.empty? }
          RestClient::Request.execute method: :post, url: url, payload: payload
        end
      end

      def subscribe ws, request_id, url
        WEB_SOCKETS[request_id] = ws
        ws.on(:close) { WEB_SOCKETS.delete request_id }

        send_bs_error_on ws do
          payload = {
            callback_url: "#{ENV['LODQA']}/requests/#{request_id}/events"
          }

          RestClient::Request.execute method: :post, url: url, payload: payload
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
