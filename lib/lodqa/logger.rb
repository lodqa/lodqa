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

      def debug(message, name = nil, id = nil)
        if @debug
          id ||= request_id
          puts "request_id: #{id}, message: #{message}"
        end
      end

      def error(message, id = nil)
        id ||= request_id
        puts "request_id: #{id}, message: #{message}"
      end
    end
  end
end
