const render = require('./render')

// Render all of the progress bar
module.exports = class {
  constructor(dom, model) {
    model.on('sparql_progress_change_event', () => render(dom, model))
    model.on('sparql_progress_show_detail_event', () => render(dom, model))
  }
}
