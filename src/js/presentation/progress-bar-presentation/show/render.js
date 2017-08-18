const handlebars = require('handlebars')

const template = handlebars.compile(`
  <ul class="sparqls">
    {{#each sparqls}}
      <li class="sparql" data-sparql-number="{{sparqlNumber}}">
        <span class="sparql-number">S{{sparqlNumber}}</span>
        <span class="number-of-answers">
          {{#if @first}}
            <i class="fa fa-spinner fa-spin fa-fw"></i>
          {{/if}}
        </span>
        <span class="except-from-answers">
          <input type="checkbox" id="except-{{sparqlNumber}}"><label for="except-{{sparqlNumber}}">except</label>
        </span>
      </li>
    {{/each}}
  </ul>
`)

module.exports = function(domId, viewModel, onClick, onChange) {
  const element = document.querySelector(`#${domId}`)

  element
    .innerHTML = template({
      sparqls: viewModel
    })

  // Bind an event handler on click events of sparqls
  element.addEventListener('click', (e) => {
    const exceptFromAnswers = e.target.closest('.except-from-answers')
    if (exceptFromAnswers) {
      return
    }

    const sparql = e.target.closest('.sparql')

    if (sparql) {
      onClick(sparql.getAttribute('data-sparql-number'))
    }
  })

  // Bind an event handler on change events of checkboxes.
  element.addEventListener('change', (e) => {
    const sparql = e.target.closest('.sparql')

    if (sparql) {
      onChange(sparql.getAttribute('data-sparql-number'), e.target.checked)
    }
  })
}
