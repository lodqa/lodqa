require 'eventmachine'
require 'logger/logger'

module Lodqa
  module Async
    def self.defer
      request_id = Logger::Logger.request_id

      # An EventMachine.reactor is not running when no WebSocket request recieved.
      Faye::WebSocket.ensure_reactor_running

      EM.defer do
        Logger::Logger.request_id = request_id
        yield
      end
    end
  end
end
