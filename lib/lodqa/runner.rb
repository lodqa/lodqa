require 'logger/async'
require 'logger/logger'
require 'lodqa/lodqa'
require 'lodqa/source_channel'

module Lodqa
  module Runner
    class << self
      def start(ws, options)
        # Do not use a thread local variables for request_id, becasue this thread is shared multi requests.
        request_id = Logger::Logger.generate_request_id
        Logger::Logger.debug "Request start #{options[:name]}"

        lodqa = Lodqa.new(options[:endpoint_url], options[:graph_uri], options[:endpoint_options])
        channel = SourceChannel.new ws, options[:name]

        Logger::Logger.debug "Setuped"

        ws.on :message do |event|
          recieve_data = event.data

          # Set a request_id to the Logger::Logger at the thread of WebSocket events.
          Logger::Logger.request_id = request_id
          Logger::Logger.debug "on message #{recieve_data}"

          start_search_solutions request_id, lodqa, recieve_data, channel, options[:graph_finder_options]
        end
      end

      private

      def start_search_solutions(request_id, lodqa, recieve_data, channel, graph_finder_options)
        Logger::Logger.debug "start #{self.class.name}##{__method__}"

        json = JSON.parse(recieve_data, {:symbolize_names => true})

        lodqa.pgp = json[:pgp]
        lodqa.mappings = json[:mappings]

        Logger::Async.defer do
          begin
            Logger::Logger.debug "start async func"

            channel.start
            channel.send :sparql_count, { count: lodqa.sparqls(graph_finder_options).count }
            lodqa.each_anchored_pgp_and_sparql_and_solution(
              -> data { channel.send :anchored_pgp, data },
              -> data { channel.send :solution, data },
              graph_finder_options
            )
          rescue => e
            Logger::Logger.error e, data: recieve_data
            channel.error e
          ensure
            channel.close
          end
        end
      end

      def close(request_id, lodqa)
        Logger::Logger.request_id = request_id
        Logger::Logger.debug 'The WebSocket connection is closed.'
        lodqa.dispose request_id
      end
    end
  end
end
