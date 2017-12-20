const {
  updateChildren
} = require('../update-dom-tree')
const template = require('./template')

module.exports = class {
  constructor(dom, model) {
    model.on('progress_selected_dataset_update_event', () => this.throttle(() => render(dom, model)))
  }

  throttle(process) {
    if (!this._rendering) {
      this._rendering = true
      requestAnimationFrame(() => {
        process()
        this._rendering = false
      })
    }
  }
}

function render(dom, model) {
  const data = model.stateOfSparqlsOfSelectedDataset
  const limit = 500
  const html = template(Object.assign({}, data, {
    sparqls: data.sparqls.slice(0, limit),
    limit,
    overLimit: data.sparqls.length > limit && data.sparqls.length
  }))
  updateChildren(dom, html)
}
