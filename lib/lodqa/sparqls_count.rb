module Lodqa
  module SparqlsCount
    attr_reader :sparql_count, :request_id

    @@data = []
    class << self
      def get_request_id(request_id)
        @@data.find { |item| item[:request_id] == request_id }&.fetch(:request_id)
      end

      def get_sparql_count(request_id)
        @@data.find { |item| item[:request_id] == request_id }&.fetch(:sparql_count)
      end

      def set_sparql_count(count, request_id)
        @@data.push({ request_id: request_id, sparql_count: count })
      end
    end
  end
end
