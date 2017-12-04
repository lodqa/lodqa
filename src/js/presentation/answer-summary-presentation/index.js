const Handlebars = require('handlebars')

const {
  updateChildren
} = require('../update-dom-tree')

module.exports = class {
  constructor(dom, model) {
    model.on('answer_summary_update_event', () => render(dom, model))
  }
}

const template = Handlebars.compile(`
{{#each answers}}
<div class="answer-summary__answer">
  <h3 class="answer-summary__answer-label"><a href="{{url}}" target="_blank">{{label}}</a></h3>
  <div class="answer-summary__answer-summary">
    <div class="answer-summary__answer-url">
      <cite class="answer-summary__answer-url__cite">{{url}}</cite>
    </div>
    <ul class="answer-summary__sparql-list">
      {{#each sparqls}}
        <li class="answer-summary__sparql">
          <a href="#" data-dataset-name="{{dataset}}" data-sparql-number="{{number}}">S{{parentNumber}}-{{number}}</a>
        </li>
      {{/each}}
    </ul>
  </div>
</div>
{{/each}}
`)

function render(dom, model) {
  const html = template(model.snapshot)
  updateChildren(dom, html)
}
