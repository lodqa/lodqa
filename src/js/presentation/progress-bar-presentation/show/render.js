const handlebars = require('handlebars')
const registerPartial = require('../../../answer/register-partial')

registerPartial()

const template = handlebars.compile(`
  <div class="simple-progress-bar">
    <progress value="0" max="{{sparqls.length}}"></progress>
    <span id="simple-progress-bar__percentage">0%</span>
    <span class="checkbox">
      <input type="checkbox" id="show-detail-progress-bar">
      <label for="show-detail-progress-bar">Show detail</label>
    </span>
  </div>
  <div class="detail-progress-bar hidden">
    <div>
        <input type="checkbox" id="show-only-has-answers">
        <label for="show-only-has-answers">Show only sparqls with answers</label>
    </div>
    <ul class="sparqls">
      {{#each sparqls}}
        <li class="sparql" data-sparql-number="{{sparqlNumber}}">
          <span class="sparql-number">{{> sparql-link}}</span>
          <span class="loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
          <span class="selected-answers">
            <label class="number-of-answers"></label>
            <input type="checkbox" checked="checked">
          </span>
        </li>
      {{else}}
      <span class="no-sparql">No Sparql</span>
      {{/each}}
    </ul>
  </div>
`)

module.exports = function(domId, viewModel, onChange) {
  const element = document.querySelector(`#${domId}`)

  element
    .innerHTML = template({
      sparqls: viewModel
    })

  // Bind an event handler on change events of checkboxes.
  element.addEventListener('change', (e) => {
    const sparql = e.target.closest('.sparql')

    if (sparql) {
      onChange(sparql.getAttribute('data-sparql-number'), !e.target.checked)
    }
  })
}
