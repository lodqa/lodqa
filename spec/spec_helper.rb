require 'rspec'
require 'rack/test'
require 'simplecov'

include Rack::Test::Methods
SimpleCov.start

RSpec.configure do |config|
  # Use color in STDOUT
  config.color_enabled = true
end