#!/usr/bin/env ruby
require 'rest-client'
require 'json'
require 'term/find_error'

module Term
  # An instance of this class is initialized with a dictionary.
  class Finder
    attr_reader :dictionary

    def initialize(dictionary_url)
      raise ArgumentError, "dictionary_url should be given." if dictionary_url.nil? || dictionary_url.empty?
      @dictionary = RestClient::Resource.new dictionary_url, :headers => {:content_type => :json, :accept => :json}, :timeout => 10
    end

    def find(terms)
      return nil if terms.nil?
      return {} if terms.empty?

      terms = [terms] if terms.class == String
      return nil  unless terms.class == Array
      mappings = _lookup(terms)

      # interpolation
      mappings.each_key do |k|
        if mappings[k].empty?
          ngram = k.to_s.split
          length = ngram.length
          (1 ... length).reverse_each do |m|
            subkeys = (0 .. length - m).collect{|b| ngram[b, m].join(' ')}
            submappings = _lookup(subkeys).values.flatten.uniq
            unless submappings.empty?
              mappings[k] = [submappings.last]
              break
            end
          end
        end
      end
    end

    private

    def _lookup(terms)
      @dictionary.post terms.to_json do |response, request, result|
        case response.code
        when 200
          JSON.parse(response, symbolize_names: true)
        else
          # request to dictionary is not success
          Logger::Logger.debug "A requet to the dictionary failed", method: request.method, url: request.uri, requet_body: terms.to_json, status: response.code, response_body: response
          raise FindError, "Term find error to #{request.uri}"
        end
      end
    rescue RestClient::Exceptions::ReadTimeout
      Logger::Logger.info "A request to the dictionary was timeout", url: @dictionary.url, requet_body: terms.to_json
      raise FindError, "Term find timeout error to #{@dictionary.url}"
    end
  end
end
