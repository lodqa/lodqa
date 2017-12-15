const createDom = require('../../create-dom')
const template = require('./template')

module.exports = function(name) {
  return createDom(template({
    name
  }))
}
