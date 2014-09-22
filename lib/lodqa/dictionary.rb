#!/usr/bin/env ruby
require 'rest-client'
require 'json'

module Lodqa; end unless defined? Lodqa

# An instance of this class is initialized with a dictionary.
class Lodqa::Dictionary
  def initialize (dictionary_url)
    @dictionary = RestClient::Resource.new dictionary_url, :headers => {:content_type => :json, :accept => :json}
  end

  def lookup (terms)
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
    @dictionary.post :terms => terms.to_json do |response, request, result|
      case response.code
      when 200
        JSON.parse response
      else
        terms.map{|t| [t, []]}.to_h
      end
    end
  end
end
