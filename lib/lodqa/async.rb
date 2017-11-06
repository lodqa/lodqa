require 'eventmachine'
require 'lodqa/logger'

module Lodqa
  module Async
    def self.defer
      request_id = Logger.request_id

      EM.defer do
        Logger.request_id = request_id
        yield
      end
    end
  end
end
