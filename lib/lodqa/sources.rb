require 'rest_client'
require 'lodqa/source_error'

module Lodqa
  module Sources
    class << self
      def applicants_from(target_url)
        begin
          RestClient.get target_url do |response, request, result|
            case response.code
            when 200 then JSON.parse response, {:symbolize_names => true}
            else
              Logger::Logger.error nil, message: "Configuration Server retrun an error for #{target_url}", response_code: response.code, response_body: response.body
              raise IOError, "Response Error for url: #{target_url}"
            end
          end
        rescue => e
          Logger::Logger.error e, message: "Cannot connect the Configuration Server for #{target_url}"
          raise SourceError, "invalid url #{target_url}"
        end
      end
    end
  end
end
