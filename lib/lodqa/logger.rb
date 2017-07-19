module Lodqa
  module Logger
    class << self
      $stdout.sync = true

      def level=(level)
        @debug = (level == :debug)
      end

      def debug(message, request_id = nil)
        if @debug
          request_id ||= Thread.current.thread_variable_get(:request_id)
          puts "request_id: #{request_id}, message: #{message}"
        end
      end

      def error(message, request_id = nil)
        request_id ||= Thread.current.thread_variable_get(:request_id)
        puts "request_id: #{request_id}, message: #{message}"
      end
    end
  end
end
