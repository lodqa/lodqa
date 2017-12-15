require 'lodqa/lodqa'
require 'lodqa/logger'
require 'lodqa/source_channel'
require 'lodqa/async'

module Lodqa
  module Runner
    class << self
      def start(ws, options)
        # Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
        request_id = Logger.generate_request_id
        Logger.debug "Request start #{options[:name]}"

        lodqa = Lodqa.new(options[:endpoint_url], options[:graph_uri], options)
        channel = SourceChannel.new ws, options[:name]

        Logger.debug "Setuped"

        # Set a request_id to the Logger at the thread of WebSocket events.
        ws.onmessage do |recieve_data|
          Logger.debug "on message"
          start_search_solutions request_id, lodqa, recieve_data, channel
        end
        ws.onclose { close request_id, lodqa }
      end

      private

      def start_search_solutions(request_id, lodqa, recieve_data, channel)
        Logger.debug "start #{self.class.name}##{__method__}"

        json = JSON.parse(recieve_data, {:symbolize_names => true})

        lodqa.pgp = json[:pgp]
        lodqa.mappings = json[:mappings]

        Async.defer do
          begin
            Logger.debug "start async func"

            channel.start
            lodqa.each_anchored_pgp_and_sparql_and_solution(
              -> (data) { channel.send(sparqls: data) },
              -> (data){ channel.send(anchored_pgp: data) },
              -> (data) { channel.send(solution: data) }
            )
          rescue => e
            Logger.error e, data: recieve_data
            channel.error e
          ensure
            channel.close
          end
        end
      end

      def close(request_id, lodqa)
        Logger.request_id = request_id
        Logger.debug 'The WebSocket connection is closed.', nil
        lodqa.dispose request_id
      end
    end
  end
end
