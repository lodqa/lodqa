const updateDomTree = require('../update-dom-tree')
const template = require('./template')

module.exports = class {
  constructor(dom, model) {
    model.on('answer_media_update_event', () => render(dom, model))
  }
}

function render(dom, model) {
  const html = template(model.snapshot)
  updateDomTree(dom, html)
}
