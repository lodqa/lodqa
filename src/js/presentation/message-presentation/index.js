const updateDomTree = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('message_update_event', () => render(dom, model))
  }
}

function render(dom, model) {
  const html = `${model.message}`
  updateDomTree(dom, html)
}
