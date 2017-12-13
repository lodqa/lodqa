const {
  updateChildren
} = require('../update-dom-tree')
const template = require('./template')

module.exports = class {
  constructor(dom, model) {
    model.on('answer_summary_update_event', () => render(dom, model))
  }
}

function render(dom, model) {
  const html = template(model.snapshot)
  updateChildren(dom, html)
}
