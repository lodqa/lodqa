require 'rest_client'

module Lodqa
  module Sources
    class << self
      def applicants_from(target_url)
        begin
          RestClient.get target_url do |response, request, result|
            case response.code
            when 200 then JSON.parse response, {:symbolize_names => true}
            else
              Logger.error nil, message: "Configuration Server retrun an error for #{target_url}", response_code: response.code, response_body: response.body
              raise IOError, "Response Error for url: #{target_url}"
            end
          end
        rescue
          Logger.error nil, message: "Cannot connect the Configuration Server for #{target_url}"
          raise IOError, "invalid url #{target_url}"
        end
      end
    end
  end
end
