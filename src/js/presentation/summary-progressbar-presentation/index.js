const Handlebars = require('handlebars')

const {
  updateChildren
} = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('progress_summary_update_event', () => render(dom, model))
    dom.addEventListener('click', (({
      target
    }) => {
      if (target.closest('.summary-progress__checkbox')) {
        model.showDatasets(target.checked)
      }
    }))
  }
}

const template = Handlebars.compile(`
  <progress class="summary-progress__progressbar" max="{{max}}" value="{{value}}"></progress>
  <input class="summary-progress__checkbox" id="summary-progress__checkbox" type="checkbox" {{#if showDatasets}}checked="checked"{{/if}}/>
  <label for="summary-progress__checkbox">Show progerss per datasets</label>
`)

function render(dom, model) {
  const html = template(model.snapshot)
  updateChildren(dom, html)
}
