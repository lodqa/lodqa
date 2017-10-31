module Lodqa
  class SourceChannelData
    def initialize(source)
      @source = source
    end

    def format(data = {})
      data.merge!({source: @source}).to_json
    end
  end
end
