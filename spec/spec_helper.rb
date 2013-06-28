require 'rspec'
require 'rack/test'

include Rack::Test::Methods

RSpec.configure do |config|
  # Use color in STDOUT
  config.color_enabled = true
end