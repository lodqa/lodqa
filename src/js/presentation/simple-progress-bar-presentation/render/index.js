const createDom = require('../../create-dom')
const template = require('./template')

module.exports = function(name, total) {
  const sparqls = Array(total)

  return createDom(template({
    name,
    sparqls
  }))
}
