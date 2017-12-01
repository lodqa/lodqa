require 'sparql/client'

# Cache results of sparql to speed up SPARQL queries.
module Lodqa
  class CachedSparqlClient
    def initialize(endpoint_url, endpoint_options)
      @client = SPARQL::Client.new(endpoint_url, endpoint_options)
      @cache = {}
    end

    def query(sparql)
      if @cache.key? sparql
        @cache[sparql]
      else
        @client.query(sparql).tap{ |result| @cache[sparql] = result }
      end
    end

    def select(*args)
      @cilent.select(*args)
    end
  end
end
