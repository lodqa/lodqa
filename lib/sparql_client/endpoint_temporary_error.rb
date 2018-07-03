require 'sparql_client/endpoint_error'

module SparqlClient
  class EndpointTemporaryError < EndpointError
    attr_reader :sparql

    def initialize(e, endpoint_name, sparql)
      super(e, endpoint_name)
      @sparql = sparql
    end
  end
end
