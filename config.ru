require 'puma'

root_dir = File.dirname(__FILE__)
$LOAD_PATH << root_dir + '/lib'
require root_dir + '/lodqa-ws'

use Rack::Deflater
run LodqaWS
