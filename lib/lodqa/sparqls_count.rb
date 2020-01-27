module Lodqa
  module SparqlsCount

    @@data = { id_and_count: [] }
    class << self
      def get_sparql_count(request_id)
        @@data[:id_and_count].find { |item| item[:request_id] == request_id }&.fetch(:sparql_count)
      end

      def set_sparql_count(count, request_id)
        @@data[:id_and_count] << { request_id: request_id, sparql_count: count }
      end
    end
  end
end
