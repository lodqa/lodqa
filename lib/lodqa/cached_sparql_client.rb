require 'sparql/client'
require 'lodqa/sparql_endpoint_error'
require 'lodqa/sparql_endpoint_temporary_error'
require 'lodqa/sparql_endpoint_timeout_error'
require 'lodqa/logger'

# Cache results of sparql to speed up SPARQL queries.
module Lodqa
  class CachedSparqlClient
    def initialize(endpoint_url, endpoint_options)
      @endpoint_url = endpoint_url
      @client = SPARQL::Client.new(endpoint_url, endpoint_options)
      @cache = {}
    end

    def query(sparql)
      if @cache.key? sparql
        @cache[sparql]
      else
        begin
          @client.query(sparql).tap{ |result| @cache[sparql] = result }
        rescue Net::HTTP::Persistent::Error => e
          # A timeout error was reterned from the Endpoint
          Logger.debug 'SPARQL Timeout Error', error_messsage: e.message, trace: e.backtrace
          raise SparqlEndpointTimeoutError.new e, @endpoint_url, sparql
        rescue SPARQL::Client::ServerError, SocketError, Errno::ECONNREFUSED => e
          # A temporary error was reterned from the Endpoint
          Logger.debug 'SPARQL Endpoint Temporary Error', error_messsage: e.message, trace: e.backtrace
          raise SparqlEndpointTemporaryError.new e, @endpoint_url, sparql
        rescue OpenSSL::SSL::SSLError => e
          Logger.debug 'SPARQL Endpoint Persistent Error', error_messsage: e.message, trace: e.backtrace
          raise SparqlEndpointError.new e, @endpoint_url
        rescue => e
          Logger.error e, message: 'Unknown Error occurs during request SPARQL to the Endpoint'
          raise e
        end
      end
    end

    def select(*args)
      @cilent.select(*args)
    end
  end
end
