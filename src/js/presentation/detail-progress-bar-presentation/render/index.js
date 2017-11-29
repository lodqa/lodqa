const {
  updateDom
} = require('../../update-dom-tree')
const template = require('./template')

module.exports = function(dom, dataset) {
  const html = template({
    name: dataset.name,
    sparqls: dataset.currentStatusOfSparqls
  })
  updateDom(dom, html)
}
