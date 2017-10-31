require 'securerandom'
require 'eventmachine'
require 'lodqa'

module Lodqa
  module Runner
    class << self
      def start(ws, options)
        lodqa = Lodqa.new(options[:endpoint_url], options[:graph_uri], options)

        request_id = SecureRandom.uuid

        # Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
        Logger.debug('Request start', request_id)

        proc_sparqls = Proc.new do |sparqls|
          ws_send(ws, :sparqls, sparqls)
        end

        proc_anchored_pgp = Proc.new do |anchored_pgp|
          ws_send(ws, :anchored_pgp, anchored_pgp)
        end

        proc_solution = Proc.new do |solution|
          ws_send(ws, :solution, solution)
        end

        ws.onmessage do |data|
          json = JSON.parse(data, {:symbolize_names => true})

          lodqa.pgp = json[:pgp]
          lodqa.mappings = json[:mappings]

          EM.defer do
            Thread.current.thread_variable_set(:request_id, request_id)

            begin
              ws.send("start")
              lodqa.each_anchored_pgp_and_sparql_and_solution(proc_sparqls, proc_anchored_pgp, proc_solution)
            rescue => e
              Logger.error "error: #{e.inspect}, backtrace: #{e.backtrace}, data: #{data}"
              ws.send({error: e}.to_json)
            ensure
              ws.close_connection(true)
            end
          end
        end

        ws.onclose do
          # Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
          Logger.debug 'The WebSocket connection is closed.', request_id
          lodqa.dispose request_id
        end
      end

      private

      def ws_send(websocket, key, value)
        websocket.send({key => value}.to_json)
      end
    end
  end
end
