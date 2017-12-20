const {
  updateChildren
} = require('../../update-dom-tree')
const template = require('./template')

module.exports = function(dom, dataset) {
  const html = template(dataset.currentStatusOfSparqls)
  updateChildren(dom, html)
}
