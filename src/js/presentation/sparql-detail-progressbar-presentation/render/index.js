const {
  updateChildren
} = require('../../update-dom-tree')
const template = require('./template')

module.exports = function(dom, model) {
  const data = model.currentStatusOfSparqls
  const limit = 500
  const html = template(Object.assign({}, data, {
    sparqls: data.sparqls.slice(0, limit),
    limit,
    overLimit: data.sparqls.length > limit
  }))
  updateChildren(dom, html)
}
