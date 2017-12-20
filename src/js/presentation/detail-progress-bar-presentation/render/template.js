const handlebars = require('handlebars')

module.exports = handlebars.compile(`
<ul class="detail-progress-bar__sparqls">
  {{#each sparqls}}
    {{#if error}}
      <li class="
        detail-progress-bar__sparqls__sparql
        detail-progress-bar__sparqls__sparql--error
      " data-sparql-number="{{sparqlNumber}}">
        <span class="detail-progress-bar__sparqls__sparql__sparql-number">S{{sparqlNumber}}</span>
        <label class="detail-progress-bar__sparqls__sparql__number-of-answers button" for="sparql-number-{{sparqlNumber}}"><i class="fa fa-bomb" aria-hidden="true" title="{{error}}"></i></label>
      </li>
    {{else if hasSolution}}
      <li class="
        detail-progress-bar__sparqls__sparql
        {{#if uniqAnswersLength}}
          detail-progress-bar__sparqls__sparql--has-answer
        {{else}}
          detail-progress-bar__sparqls__sparql--no-answer
        {{/if}}
      " data-sparql-number="{{sparqlNumber}}">
        <span class="detail-progress-bar__sparqls__sparql__sparql-number">S{{sparqlNumber}}</span>
        <label class="detail-progress-bar__sparqls__sparql__number-of-answers" for="sparql-number-{{sparqlNumber}}">{{uniqAnswersLength}}</label>
      </li>
    {{else if isProgress}}
      <li class="
        detail-progress-bar__sparqls__sparql
        detail-progress-bar__sparqls__sparql--progress
      " data-sparql-number="{{sparqlNumber}}">
        <span class="detail-progress-bar__sparqls__sparql__sparql-number">S{{sparqlNumber}}</span>
        <span class="detail-progress-bar__sparqls__sparql__loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
      </li>
    {{else}}
      <li class="
        detail-progress-bar__sparqls__sparql
        {{#if isProgress}}
          detail-progress-bar__sparqls__sparql--progress
        {{/if}}
      " data-sparql-number="{{sparqlNumber}}">
        <span class="detail-progress-bar__sparqls__sparql__sparql-number">S{{sparqlNumber}}</span>
      </li>
    {{/if}}
  {{/each}}
</ul>
`)
