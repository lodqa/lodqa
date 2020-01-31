require 'net/http'
require 'uri'
require 'json'

module Lodqa
  class Oauth
    def initialize(code)
      @auth_code = code
    end

    def me_account
      return nil unless @auth_code

      profile_info access_token_id
    end

    private

    def access_token_id
      uri = URI.parse("#{ENV['URL_TOKEN']}")
      request = Net::HTTP::Post.new(uri)
      request.set_form_data(
        'client_id': "#{ENV['CLIENT_ID']}",
        'client_secret': "#{ENV['CLIENT_SECRET']}",
        'code': "#{@auth_code}",
        'grant_type': 'authorization_code',
        'redirect_uri': "#{ENV['REDIRECT_URI']}"
      )

      begin
        response = Net::HTTP.start(uri.hostname, uri.port, options(uri)) do |http|
          http.request(request)
        end

        case response.code
        when '200' then
          token_info = JSON.parse response.body, { symbolize_names: true }
          token_info[:access_token]
        else
          Logger::Logger.error nil, message: "Configuration Token Server return an error for #{uri}", response_code: response.code, response_body: response.body
          raise IOError, "Response Error for url: #{uri}"
          nil
        end
      rescue => e
        Logger::Logger.error e, message: "Cannot connect the Configuration Token Server for #{uri}"
      end
    end

    def profile_info token_id
      return nil unless token_id

      uri = URI.parse("#{ENV['URL_PROFILE']}")
      request = Net::HTTP::Get.new(uri)
      request["Authorization"] = "Bearer #{token_id}"

      begin
        response = Net::HTTP.start(uri.hostname, uri.port, options(uri)) do |http|
          http.request(request)
        end

        case response.code
        when '200' then
          profile_info = JSON.parse response.body, { symbolize_names: true }
          profile_info[:emailAddress]
        else
          Logger::Logger.error nil, message: "Configuration Profile Server return an error for #{uri}", response_code: response.code, response_body: response.body
          raise IOError, "Response Error for url: #{uri}"
          nil
        end
      rescue => e
        Logger::Logger.error e, message: "Cannot connect the Configuration Profile Server for #{uri}"
      end
    end

    def options uri
      { use_ssl: uri.scheme == 'https' }
    end
  end
end
