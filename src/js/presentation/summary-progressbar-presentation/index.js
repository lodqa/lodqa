const Handlebars = require('handlebars')

const {
  updateChildren
} = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('progress_summary_update_event', () => render(dom, model))
  }
}

const template = Handlebars.compile(`
  <progress class="summary-progressbar__progressbar" max="{{max}}" value="{{value}}"></progress>
  <input class="summary-progressbar__checkbox" id="summary-progressbar__checkbox" type="checkbox" {{#if showDatasets}}checked="checked"{{/if}}/>
  <label for="summary-progressbar__checkbox">Show progerss per datasets</label>
`)

function render(dom, model) {
  const html = template(model.snapshot)
  updateChildren(dom, html)
}
