#!/usr/bin/env ruby
require 'rest-client'
require 'json'

module Lodqa; end unless defined? Lodqa

# An instance of this class is initialized with a dictionary.
class Lodqa::Dictionary
  def initialize (dictionary_url)
    p dictionary_url
    @dictionary = RestClient::Resource.new dictionary_url, :headers => {:content_type => :json, :accept => :json}
  end

  def lookup (term)
    uris = @dictionary.post :terms => [term].to_json do |response, request, result|
      case response.code
      when 200
        JSON.parse response
      else
        nil
      end
    end
    uris
  end

  def find_uris (nodes)
    p nodes
    terms = nodes.collect{|n| n[:text]}
    uris  = @dictionary.post :terms => terms.to_json do |response, request, result|
      case response.code
      when 200
        puts "got <====="
        JSON.parse response
      else
        nil
      end
    end

    # nodes.each{|n| n[:term] = uris[n[:text]].map{|u| "<#{u}>"}[0]}
    uris.nil? ? nil : nodes.collect{|n| uris[n[:text]].map{|u| "<#{u}>"}}
  end
end
