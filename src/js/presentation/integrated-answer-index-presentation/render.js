const template = require('./template')

module.exports = function render(dom, integratedDataset) {
  const before = dom.innerHTML
  const after = template(integratedDataset.integratedAnswerIndex)
  if (before !== after) {
    dom.innerHTML = after
  }
}
