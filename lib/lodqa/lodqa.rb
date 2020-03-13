#!/usr/bin/env ruby
require 'net/http'
require 'json'
require 'enju_access/cgi_accessor'
require 'logger/logger'
require 'sparql_client/cacheable_client'
require 'lodqa/graph_finder'
require 'logger/logger'
require 'lodqa/sources'
require 'lodqa/pgp_factory'
require 'lodqa/configuration'

module Lodqa
  class Lodqa
    attr_reader   :parse_rendering
    attr_accessor :pgp
    attr_accessor :mappings

    attr_reader :endpoint

    def initialize(ep_url, endpoint_options, graph_uri, graph_finder_options)
      @sparql_client = SparqlClient::CacheableClient.new(ep_url, endpoint_options)
      @graph_finder = GraphFinder.new(@sparql_client, graph_uri, graph_finder_options)
    end

    # Return an enumerator to speed up checking the existence of sparqls.
    def sparqls
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      Enumerator.new do |y|
        begin
          anchored_pgps.each do |anchored_pgp|
            to_sparql(anchored_pgp){ |sparql| y << sparql}
          end
        rescue SparqlClient::EndpointError => e
          Logger::Logger.debug "The SPARQL Endpoint #{e.endpoint_name} has a persistent error, continue to the next Endpoint", error_message: e.message
        end
      end
    end

    def anchored_pgps
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      Enumerator.new do |anchored_pgps|
        @pgp[:nodes].delete_if{|n| nodes_to_delete.include? n}
        @pgp[:edges].uniq!
        terms = @pgp[:nodes].values.map{|n| @mappings[n[:text].to_sym]}

        terms.map!{|t| t.nil? ? [] : t}

        Logger::Logger.debug "terms: #{ terms.first.product(*terms.drop(1)) }"

        terms.first.product(*terms.drop(1))
          .each do |ts|
            anchored_pgp = pgp.dup
            anchored_pgp[:nodes] = pgp[:nodes].dup
            anchored_pgp[:nodes].each_key{|k| anchored_pgp[:nodes][k] = pgp[:nodes][k].dup}
            anchored_pgp[:nodes].each_value.with_index{|n, i| n[:term] = ts[i]}

            anchored_pgps << anchored_pgp
          end
      end
    end

    private

    def to_sparql(anchored_pgp)
      if @cancel_flag
        Logger::Logger.debug "Stop during creating SPARQLs for anchored_pgp: #{anchored_pgp}"
        return
      end

      Logger::Logger.debug "create graph finder"

      if @cancel_flag
        Logger::Logger.debug "Stop during creating SPARQLs for anchored_pgp: #{anchored_pgp}"
        return
      end

      Logger::Logger.debug "return SPARQLs of bgps"
      @graph_finder.sparqls_of(anchored_pgp) do |bgp, sparql|
        yield sparql
      end
    end

    def nodes_to_delete
      Logger::Logger.debug "start #{self.class.name}##{__method__}"

      nodes_to_delete = []
      @pgp[:nodes].each_key do |n|
        if @mappings[@pgp[:nodes][n][:text]].nil? || @mappings[@pgp[:nodes][n][:text]].empty?
          connected_nodes = []
          @pgp[:edges].each{|e| connected_nodes << e[:object] if e[:subject] == n}
          @pgp[:edges].each{|e| connected_nodes << e[:subject] if e[:object] == n}

          # if it is a passing node
          if connected_nodes.length == 2
            nodes_to_delete << n
            @pgp[:edges].each do |e|
              e[:object]  = connected_nodes[1] if e[:subject] == connected_nodes[0] && e[:object]  == n
              e[:subject] = connected_nodes[1] if e[:subject] == n && e[:object]  == connected_nodes[0]
              e[:object]  = connected_nodes[0] if e[:subject] == connected_nodes[1] && e[:object]  == n
              e[:subject] = connected_nodes[0] if e[:subject] == n && e[:object]  == connected_nodes[1]
            end
          end
        end
      end
      nodes_to_delete
    end
  end
end
