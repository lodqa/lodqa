const createDom = require('../../../create-dom')
const template = require('./template')

module.exports = function(name, total) {
  // An array instance created by `new Array(arrayLength)` does not loop.
  const sparqls = Array.from(Array(total))
    .map((val, index) => ({
      sparqlNumber: index + 1
    }))

  return createDom(template({
    name,
    sparqls
  }))
}
