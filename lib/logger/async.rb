require 'eventmachine'
require 'faye/websocket'
require 'logger/logger'

class Logger
  module Async
    # Defer the process received as a block.
    # The process run in an another thread by EM.defer.
    # The request id for logging will be relayed automatically.
    def self.defer
      request_id = Logger.request_id

      # An EventMachine.reactor is not running when no WebSocket request recieved.
      Faye::WebSocket.ensure_reactor_running

      EM.defer do
        Logger.request_id = request_id
        yield
      end
    end
  end
end
