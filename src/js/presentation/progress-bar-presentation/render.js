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
      </li>
    {{/each}}
  </ul>
`)

module.exports = function(domId, viewModel) {
  document.querySelector(`#${domId}`)
    .innerHTML = template({
      sparqls: viewModel
    })
}
