const template = require('./template')
const updateDomTree = require('../../update-dom-tree')

module.exports = function render(dom, integratedDataset) {
  const html = template(integratedDataset.integratedAnswerIndex)
  updateDomTree(dom, html)
}
