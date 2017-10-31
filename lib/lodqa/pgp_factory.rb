require 'lodqa/graphicator'

module Lodqa
  module PGPFactory
    def self.create(parser_url, query)
      g = Graphicator.new(parser_url)
  		g.parse(query)
  		g.get_pgp
    end
  end
end
