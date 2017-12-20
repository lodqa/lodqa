const handlebars = require('handlebars')

module.exports = handlebars.compile(`
{{#if show}}
  <ul class="detail-progressbar__sparql-list">
    {{#each sparqls}}
      {{#if error}}
        <li class="
          detail-progressbar__sparql
          detail-progressbar__sparql--error
        ">
          <span class="detail-progressbar__sparql-number">S{{sparqlNumber}}</span>
          <span class="detail-progressbar__number-of-answers"><i class="fa fa-bomb" aria-hidden="true" title="{{error}}"></i></span>
        </li>
      {{else if hasSolution}}
        <li class="
          detail-progressbar__sparql
          {{#if uniqAnswersLength}}
            detail-progressbar__sparql--has-answer
          {{else}}
            detail-progressbar__sparql--no-answer
          {{/if}}
        ">
          <span class="detail-progressbar__sparql-number">S{{sparqlNumber}}</span>
          <span class="detail-progressbar__number-of-answers">{{uniqAnswersLength}}</span>
        </li>
      {{else if isProgress}}
        <li class="
          detail-progressbar__sparql
          detail-progressbar__sparql--progress
        ">
          <span class="detail-progressbar__sparql-number">S{{sparqlNumber}}</span>
          <span class="detail-progressbar__sparql__loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
        </li>
      {{else}}
        <li class="
          detail-progressbar__sparql
        ">
          <span class="detail-progressbar__sparql-number">S{{sparqlNumber}}</span>
        </li>
      {{/if}}
    {{else}}
      <span class="detail-progressbar__waiting-sparql-message">Waiting SPARQLs ...</span>
    {{/each}}
  </ul>
  {{#if overLimit}}
    Limit the number of displayed SPARQL to {{limit}}.
  {{/if}}
{{/if}}
`)
