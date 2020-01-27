module Lodqa
  module SparqlsCount

    @@data = []
    class << self
      def get_sparql_count(request_id)
        @@data.find { |item| item[:request_id] == request_id }&.fetch(:sparql_count)
      end

      def set_sparql_count(count, request_id)
        @@data.push({ request_id: request_id, sparql_count: count })
      end
    end
  end
end
