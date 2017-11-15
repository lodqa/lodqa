const createDom = require('../../create-dom')
const template = require('./template')

module.exports = function(sparqls) {
  return createDom(template({
    sparqls
  }))
}
