const {
  updateChildren
} = require('../../update-dom-tree')
const template = require('./template')

module.exports = function(dom, dataset) {
  const html = template({
    sparqls: dataset.currentStatusOfSparqls
  })
  updateChildren(dom, html)
}
