# using SendGrid's Ruby Library
# https://github.com/sendgrid/sendgrid-ruby
require 'sendgrid-ruby'

module Lodqa
  module MailSender
    include SendGrid
    def self.send_mail to, subject, body
      from = Email.new(email: 'lodqa-mailer@lodqa.org')
      to = Email.new(email: to)
      content = Content.new(type: 'text/plain', value: body)
      mail = Mail.new(from, subject, to, content)

      sg = SendGrid::API.new(api_key: ENV['SENDGRID_API_KEY'])
      res = sg.client.mail._('send').post(request_body: mail.to_json)
      pp res
    end
  end
end
