module Lodqa
  module SparqlsCount
    attr_reader :sparql_count

    class << self
      def get_sparql_count
        @sparql_count
      end

      def set_sparql_count(count)
        @sparql_count = count
      end
    end
  end
end
