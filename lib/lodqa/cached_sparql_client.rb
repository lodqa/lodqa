require 'sparql/client'
require 'lodqa/sparql_endpoint_error'
require 'lodqa/sparql_endpoint_temporary_error'
require 'lodqa/sparql_endpoint_timeout_error'
require 'lodqa/logger'

# Cache results of sparql to speed up SPARQL queries.
module Lodqa
  class CachedSparqlClient
    def initialize(endpoint_url, endpoint_options = {})
      @endpoint_url = endpoint_url

      endpoint_options[:read_timeout] |= 60
      # Set default HTTP method to GET.
      # Default HTTP method of SparqlClient is POST.
      # But POST method in HTTP 1.1 may occurs conection broken error.
      # If HTTP method is GET, when HTTP connection error occurs, a request is retried by HTTP stack of Ruby standard library.
      endpoint_options[:method] ||= :get
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
        rescue OpenSSL::SSL::SSLError, SPARQL::Client::ClientError => e
          # TODO What is the SPARQL::Client::ClientError?
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
