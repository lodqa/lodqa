const Handlebars = require('handlebars')

const {
  updateChildren
} = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('progress_datasets_update_event', () => render(dom, model))
  }
}

const template = Handlebars.compile(`
  {{#each this}}
    <div class="datasets-progress__infomation">
      <span class="datasets-progress__label">{{name}}</span>
      <div>
        <input type="checkbox" id="datasets-progress__checkbox__{{name}}" data-name="{{name}}" class="datasets-progress__checkbox" {{#if show}}checked="checked"{{/if}}>
        <label for="datasets-progress__checkbox__{{name}}">Details</label>
      </div>
    </div>
    <div class="datasets-progress__progress">
      <progress class="datasets-progress__progressbar" value="{{value}}" max="{{max}}"></progress>
      <span class="datasets-progress__progress-label">{{percentage}}%</span>
    </div>
  {{/each}}
`)

function render(dom, model) {
  const html = template(model.snapshot)
  updateChildren(dom, html)
}
