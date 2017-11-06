module Lodqa
  module Logger
    class << self
      $stdout.sync = true

      def level=(level)
        @debug = (level == :debug)
      end

      def generate_request_id
        SecureRandom.uuid
      end

      def request_id
        Thread.current.thread_variable_get(:request_id)
      end

      def request_id=(id)
        Thread.current.thread_variable_set(:request_id, id)
      end

      def debug(message, id = nil, **rest)
        if @debug
          puts "#{{
            level: 'DEBUG',
            request_id: id || request_id,
            message: message
          }
          .merge(rest)
          .to_json}"
        end
      end

      def error(error, **rest)
        error_info = {
          level: 'ERROR',
          request_id: request_id,
          message: error.message,
          trace: error.backtrace
        }.merge(rest)

        puts "#{error_info.to_json}"
      end
    end
  end
end
