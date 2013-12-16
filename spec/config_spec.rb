require 'spec_helper'
require_relative '../lodqaWS'

describe 'lodqaWS' do
	def app
		Sinatra::Application
	end

	it "should show the front page" do
		get '/'
		last_response.should be_ok
	end
end