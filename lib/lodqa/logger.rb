require 'logger'

module Lodqa
  class Logger
    class << self
      $stdout.sync = true

      def level=(level)
        @log.level = level
      end

      def generate_request_id
        SecureRandom.uuid.tap{ |id| self.request_id = id }
      end

      def request_id
        Thread.current.thread_variable_get(:request_id)
      end

      def request_id=(id)
        Thread.current.thread_variable_set(:request_id, id)
      end

      def debug(message, id = nil, **rest)
        @log.debug "#{{
          request_id: id || request_id,
          message: message
        }
        .merge(rest)
        .to_json}"
      end

      def error(error, **rest)
        error_info = {
          request_id: request_id,
          message: error.message,
          class: error.class,
          trace: error.backtrace
        }.merge(rest)

        @log.error "#{error_info.to_json}"
      end

      protected

      def init()
        @log = ::Logger.new(STDOUT)
      end
    end

    self.init
  end
end
