const updateDomTree = require('../../update-dom-tree')
const template = require('./template')

module.exports = function(dom, dataset) {
  const html = template({
    name: dataset.name,
    sparqls: dataset.currentStatusOfSparqls
  })
  return (updateDomTree(dom, html))
}
