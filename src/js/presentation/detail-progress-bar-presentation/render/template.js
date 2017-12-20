const handlebars = require('handlebars')

module.exports = handlebars.compile(`
<ul class="detail-progress-bar__sparql-list">
  {{#each sparqls}}
    {{#if error}}
      <li class="
        detail-progress-bar__sparql
        detail-progress-bar__sparql--error
      ">
        <span class="detail-progress-bar__sparql-number">S{{sparqlNumber}}</span>
        <span class="detail-progress-bar__number-of-answers"><i class="fa fa-bomb" aria-hidden="true" title="{{error}}"></i></span>
      </li>
    {{else if hasSolution}}
      <li class="
        detail-progress-bar__sparql
        {{#if uniqAnswersLength}}
          detail-progress-bar__sparql--has-answer
        {{else}}
          detail-progress-bar__sparql--no-answer
        {{/if}}
      ">
        <span class="detail-progress-bar__sparql-number">S{{sparqlNumber}}</span>
        <span class="detail-progress-bar__number-of-answers">{{uniqAnswersLength}}</span>
      </li>
    {{else if isProgress}}
      <li class="
        detail-progress-bar__sparql
        detail-progress-bar__sparql--progress
      ">
        <span class="detail-progress-bar__sparql-number">S{{sparqlNumber}}</span>
        <span class="detail-progress-bar__sparql__loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
      </li>
    {{else}}
      <li class="
        detail-progress-bar__sparql
      ">
        <span class="detail-progress-bar__sparql-number">S{{sparqlNumber}}</span>
      </li>
    {{/if}}
  {{/each}}
</ul>
`)
