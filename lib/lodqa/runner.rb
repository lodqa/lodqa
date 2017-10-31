require 'securerandom'
require 'eventmachine'
require 'lodqa/lodqa'
require 'lodqa/logger'
require 'lodqa/source_channel'

module Lodqa
  module Runner
    class << self
      def start(ws, options)
        # Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
        request_id = SecureRandom.uuid
        Logger.debug('Request start', request_id)

        lodqa = Lodqa.new(options[:endpoint_url], options[:graph_uri], options)
        channel = SourceChannel.new ws, options[:name]
        ws.onmessage { |recieve_data| start_search_solutions request_id, lodqa, recieve_data, channel }
        ws.onclose { close request_id, lodqa }
      end

      private

      def start_search_solutions(request_id, lodqa, recieve_data, channel)
        json = JSON.parse(recieve_data, {:symbolize_names => true})

        lodqa.pgp = json[:pgp]
        lodqa.mappings = json[:mappings]

        EM.defer do
          Thread.current.thread_variable_set(:request_id, request_id)

          begin
            channel.start
            lodqa.each_anchored_pgp_and_sparql_and_solution(
              -> (data) { channel.send(sparqls: data) },
              -> (data){ channel.send(anchored_pgp: data) },
              -> (data) { channel.send(solution: data) }
            )
          rescue => e
            Logger.error "error: #{e.inspect}, backtrace: #{e.backtrace}, data: #{recieve_data}"
            channel.error e
          ensure
            channel.close
          end
        end
      end

      def close(request_id, lodqa)
        # Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
        Logger.debug 'The WebSocket connection is closed.', request_id
        lodqa.dispose request_id
      end
    end
  end
end
