require 'lodqa/sparql_endpoint_error'

module Lodqa
  class SparqlEndpointTemporaryError < SparqlEndpointError
    attr_reader :sparql

    def initialize(e, endpoint_name, sparql)
      super(e, endpoint_name)
      @sparql = sparql
    end
  end
end
