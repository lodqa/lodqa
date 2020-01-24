module Lodqa
  module SparqlsCount
    attr_reader :sparql_count, :request_id

    class << self
      def get_request_id
        @request_id
      end

      def get_sparql_count
        @sparql_count
      end

      def set_request_id(request_id)
        @request_id = request_id
      end

      def set_sparql_count(count)
        @sparql_count = count
      end
    end
  end
end
