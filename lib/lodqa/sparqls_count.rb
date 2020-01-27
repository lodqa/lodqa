module Lodqa
  module SparqlsCount

    @@data = {}
    class << self
      def get_sparql_count(request_id)
        @@data[request_id]
      end

      def delete_sparql_count(request_id)
        @@data.delete(request_id)
      end

      def set_sparql_count(count, request_id)
        @@data[request_id] = count
      end
    end
  end
end
