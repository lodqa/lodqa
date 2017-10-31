require 'sparql/client'

# Cache results of sparql to speed up SPARQL queries.
module Lodqa
  class CachedSparqlClient
    def initialize(endpaint_url, endpoint_options)
      @client = SPARQL::Client.new(endpaint_url, endpoint_options)
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
