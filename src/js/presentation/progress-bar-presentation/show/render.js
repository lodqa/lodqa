const handlebars = require('handlebars')
const registerPartial = require('../../../answer/register-partial')

registerPartial()

const template = handlebars.compile(`
  <div>
      <input type="checkbox" id="show-only-has-answers">
      <label for="show-only-has-answers">Show only sparqls with answers</label>
  </div>
  <ul class="sparqls">
    {{#each sparqls}}
      <li class="sparql" data-sparql-number="{{sparqlNumber}}">
        <span class="sparql-number">{{> sparql-link}}</span>
        <span class="number-of-answers">
          {{#if @first}}
            <i class="fa fa-spinner fa-spin fa-fw"></i>
          {{/if}}
        </span>
        <span class="except-from-answers">
          <input type="checkbox">
        </span>
      </li>
    {{else}}
    <span class="no-sparql">No Sparql</span>
    {{/each}}
  </ul>
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
      onChange(sparql.getAttribute('data-sparql-number'), e.target.checked)
    }
  })
}
