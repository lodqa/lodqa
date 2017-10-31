require 'rest_client'

module Lodqa
  module Configuration
    class << self
      def default(root_dir)
        # default configuration
        config_file = root_dir + '/config/default-setting.json'
        config = JSON.parse File.read(config_file), {:symbolize_names => true} if File.file?(config_file)
        config = {} if config.nil?
        config
      end

      def for_target(target_url)
        config = begin
  				RestClient.get target_url do |response, request, result|
  					case response.code
  					when 200 then JSON.parse response, {:symbolize_names => true}
  					else raise IOError, "invalid target"
  					end
  				end
  			rescue
  				raise IOError, "invalid target"
  			end

  			config.delete_if{|k, v| v.nil?}
        config
      end
    end
  end
end
