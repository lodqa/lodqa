const {
  updateChildren
} = require('../../update-dom-tree')
const template = require('./template')

module.exports = function render(dom, integratedDataset) {
  const html = template(integratedDataset.integratedAnswerIndex)
  updateChildren(dom, html)
}
