#!/usr/bin/env ruby
require 'net/http'
require 'json'
require 'enju_access/cgi_accessor'
require 'logger/logger'
require 'sparql_client/cacheable_client'
require 'logger/logger'
require 'lodqa/sources'
require 'lodqa/pgp_factory'
require 'lodqa/configuration'
require 'lodqa/bs_client'

module Lodqa
  class Lodqa
    attr_reader   :parse_rendering
    attr_accessor :pgp
    attr_accessor :mappings

    attr_reader :endpoint

    def initialize(ep_url, endpoint_options, graph_uri, graph_finder_options)
      @sparql_client = SparqlClient::CacheableClient.new(ep_url, endpoint_options)
      @graph_uri = graph_uri
      @graph_finder_options = graph_finder_options
    end

    # Return an enumerator to speed up checking the existence of sparqls.
    def sparqls_count
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      BSClient.sparqls_count @pgp, @mappings, @sparql_client, @graph_uri, @graph_finder_options
    end
  end
end
