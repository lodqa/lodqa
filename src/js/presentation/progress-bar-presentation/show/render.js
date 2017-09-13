const handlebars = require('handlebars')
const registerPartial = require('../../../answer/register-partial')

registerPartial()

const template = handlebars.compile(`
  <div class="progress-bar__simple-progress-bar">
    <progress class="progress-bar__simple-progress-bar__progress" value="0" max="{{sparqls.length}}"></progress>
    <span class="progress-bar__simple-progress-bar__percentage">0%</span>
    <span class="progress-bar__simple-progress-bar__show-detail-checkbox">
      <input type="checkbox" id="show-detail-progress-bar">
      <label for="show-detail-progress-bar">Details</label>
    </span>
  </div>
  <div class="progress-bar__detail-progress-bar progress-bar__detail-progress-bar--hidden">
    <div>
        <input type="checkbox" id="show-only-has-answers">
        <label for="show-only-has-answers">Show only sparqls with answers</label>
    </div>
    <ul class="progress-bar__detail-progress-bar__sparqls">
      {{#each sparqls}}
        <li class="progress-bar__detail-progress-bar__sparqls__sparql" data-sparql-number="{{sparqlNumber}}">
          <span class="progress-bar__detail-progress-bar__sparqls__sparql__sparql-number">{{> sparql-link}}</span>
          <span class="progress-bar__detail-progress-bar__sparqls__sparql__loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
          <input class="progress-bar__detail-progress-bar__sparqls__sparql__selected-answers-checkbox button" type="checkbox" checked="checked" id="sparql-number-{{sparqlNumber}}">
          <label class="progress-bar__detail-progress-bar__sparqls__sparql__number-of-answers button" for="sparql-number-{{sparqlNumber}}"></label>
        </li>
      {{else}}
      <span class="progress-bar__detail-progress-bar__sparqls__no-sparql-message">No Sparql</span>
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
    const sparql = e.target.closest('.progress-bar__detail-progress-bar__sparqls__sparql')

    if (sparql) {
      onChange(sparql.getAttribute('data-sparql-number'), !e.target.checked)
    }
  })
}
