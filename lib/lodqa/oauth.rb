require 'net/http'
require 'uri'
require 'json'

module Lodqa
  class Oauth
    LOGIN = "#{ENV['LODQA']}/login"
    LOGOUT = "#{ENV['LODQA']}/logout"
    REDIRECT_URI="#{ENV['LODQA']}/oauth"
    URL_TOKEN_INFO = 'https://oauth2.googleapis.com/tokeninfo'
    URL_TOKEN = 'https://accounts.google.com/o/oauth2/token'
    URL_REVOKE= 'https://accounts.google.com/o/oauth2/revoke'
    URL_AUTH = "https://accounts.google.com/o/oauth2/auth?client_id=#{ENV['CLIENT_ID']}&redirect_uri=#{REDIRECT_URI}&scope=email&response_type=code&approval_prompt=force&access_type=offline"

    def initialize(auth_code)
      @token_info = token_info auth_code
    end

    def email
      return nil unless @token_info

      token_info_email @token_info[:access_token]
    end

    def refresh_token
      return nil unless @token_info

      @token_info[:refresh_token]
    end

    def self.token_revoke refresh_token_id
      return nil unless refresh_token_id

      uri = URI.parse("#{URL_REVOKE}")
      request = Net::HTTP::Post.new(uri)
      request.set_form_data(
        'token': refresh_token_id
      )

      response = Net::HTTP.start(uri.hostname, uri.port, { use_ssl: uri.scheme == 'https' }) do |http|
        http.request(request)
      end

      case response.code
      when '200' then
        response.code
      else
        Logger::Logger.error nil, message: "Configuration Revoke Server return an error for #{uri}", response_code: response.code
        nil
      end
    end

    private

    # アクセストークン取得
    #   ユーザーがアプリケーションにアクセス権を付与済みであれば、更新トークンとアクセストークンの取得した承認コードを交換する。
    #   参考URL（https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps?hl=ja）
    def token_info auth_code
      uri = URI.parse("#{URL_TOKEN}")
      request = Net::HTTP::Post.new(uri)
      request.set_form_data(
        'client_id': "#{ENV['CLIENT_ID']}",
        'client_secret': "#{ENV['CLIENT_SECRET']}",
        'code': "#{auth_code}",
        'grant_type': 'authorization_code',
        'redirect_uri': REDIRECT_URI
      )

      # レスポンス情報の例：
      #   {
      #     "access_token" : "ya29.AHES6ZTtm7SuokEB-RGtbBty9IIlNiP9-eNMMQKtXdMP3sfjL1Fc",
      #     "token_type" : "Bearer",
      #     "expires_in" : 3600,
      #     "refresh_token" : "1/HKSmLFXzqP0leUihZp2xUt3-5wkU7Gmu2Os_eBnzw74"
      #   }
      response = Net::HTTP.start(uri.hostname, uri.port, options(uri)) do |http|
        http.request(request)
      end

      case response.code
      when '200' then
        JSON.parse response.body, { symbolize_names: true }
      else
        Logger::Logger.error nil, message: "Configuration Token Server return an error for #{uri}", response_code: response.code, response_body: response.body
        nil
      end
    end

    # emailアドレス取得
    #   参考URL（https://developers.google.com/identity/sign-in/web/backend-auth#calling-the-tokeninfo-endpoint）
    def token_info_email token_id
      return nil unless token_id

      uri = URI.parse("#{URL_TOKEN_INFO}")
      request = Net::HTTP::Get.new(uri)
      request['Authorization'] = "Bearer #{token_id}"

      response = Net::HTTP.start(uri.hostname, uri.port, options(uri)) do |http|
        http.request(request)
      end

      case response.code
      when '200' then
        token_info = JSON.parse response.body, { symbolize_names: true }
        token_info[:email]
      else
        Logger::Logger.error nil, message: "Configuration TokenInfo Server return an error for #{uri}", response_code: response.code, response_body: response.body
        nil
      end
    end

    def options uri
      { use_ssl: uri.scheme == 'https' }
    end
  end
end
