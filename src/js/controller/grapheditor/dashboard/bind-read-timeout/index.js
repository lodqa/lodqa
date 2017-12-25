const bindReadTimeoutNumberEventhandler = require('./bind-read-timeout-number-eventhandler')
const {
  updateReadTimeout
} = require('../update-sample-queries')

module.exports = function() {
  bindReadTimeoutNumberEventhandler(updateReadTimeout)
}
