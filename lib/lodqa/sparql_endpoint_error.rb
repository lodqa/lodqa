module Lodqa
  class SparqlEndpointError < StandardError
    attr_reader :endpoint_name

    def initialize(e, endpoint_name)
      super(e)
      @endpoint_name = endpoint_name
    end
  end
end
