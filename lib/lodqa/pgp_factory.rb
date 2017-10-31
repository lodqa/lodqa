require 'lodqa/graphicator'

module Lodqa
  module PGPFactory
    def self.create(parser_url, query)
      Graphicator.new(parser_url).parse(query).pgp
    end
  end
end
