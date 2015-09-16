#!/usr/bin/env ruby
require 'rest-client'
require 'sparql/client'

require 'json'

module Lodqa; end unless defined? Lodqa

# An instance of this class is initialized with a dictionary.
class Lodqa::TermFinder
  attr_reader :dictionary

  def initialize (dictionary_url)
    raise ArgumentError, "dictionary_url should be given." if dictionary_url.nil? || dictionary_url.empty?
    @dictionary = RestClient::Resource.new dictionary_url, :headers => {:content_type => :json, :accept => :json}
  end

  def find (terms)
    return nil if terms.nil?
    return {} if terms.empty?

    terms = [terms] if terms.class == String
    return nil  unless terms.class == Array
    mappings = _lookup(terms)

    # interpolation
    mappings.each_key do |k|
      if mappings[k].empty?
        ngram = k.split
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

  def _lookup (terms)
    @dictionary.post terms.to_json do |response, request, result|
      case response.code
      when 200
        JSON.parse response
      else
        terms.map{|t| [t, []]}.to_h
      end
    end
  end
end
