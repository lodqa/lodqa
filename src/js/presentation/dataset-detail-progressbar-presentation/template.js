const Handlebars = require('handlebars')
const registerPartialSparqlLink = require('./register-partial-sparql-link')

registerPartialSparqlLink()

module.exports = Handlebars.compile(`
{{#if show}}
  <div>
    <span class="detail-progressbar__dataset-name" data-dataset-name="{{name}}">{{name}}</span>
    <input
      type="checkbox"
      id="show-only-has-answers-{{name}}"
      class="show-only-has-answers"
      {{#if showOnlyWithAnswer}}checked="checked"{{/if}}>
    <label for="show-only-has-answers-{{name}}">Show only SPARQLs with answers</label>
  </div>
  {{#if sparqls}}
    <ul class="detail-progressbar__sparql-list">
      {{#each sparqls}}
        {{#if error}}
          <li class="
            detail-progressbar__sparql
            detail-progressbar__sparql--error
          " data-sparql-number="{{sparqlNumber}}">
            <span class="detail-progressbar__sparql-number">{{> sparql-link}}</span>
            <label class="detail-progressbar__number-of-answers button" for="sparql-number-{{sparqlNumber}}"><i class="fa fa-bomb" aria-hidden="true" title="{{error}}"></i></label>
          </li>
        {{else if hasSolution}}
          <li class="
            detail-progressbar__sparql
            {{#if uniqAnswersLength}}
              detail-progressbar__sparql--has-answer
            {{else}}
              detail-progressbar__sparql--no-answer
            {{/if}}
          " data-sparql-number="{{sparqlNumber}}">
            <span class="detail-progressbar__sparql-number">{{> sparql-link}}</span>
            <input
              class="detail-progressbar__sparql__selected-answers-checkbox button"
              type="checkbox"
              {{#if visible}}
                checked="checked"
              {{/if}}
              id="sparql-number-{{sparqlNumber}}"
              data-dataset-name="{{datasetName}}"
              data-sparql-number="{{sparqlNumber}}">
            <label class="detail-progressbar__number-of-answers button" for="sparql-number-{{sparqlNumber}}">{{uniqAnswersLength}}</label>
          </li>
        {{else if isProgress}}
          <li class="
            detail-progressbar__sparql
            detail-progressbar__sparql--progress
          " data-sparql-number="{{sparqlNumber}}">
            <span class="detail-progressbar__sparql-number">{{> sparql-link}}</span>
            <span class="detail-progressbar__sparql__loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
          </li>
        {{else}}
          <li class="
            detail-progressbar__sparql
            {{#if isProgress}}
              detail-progressbar__sparql--progress
            {{/if}}
          " data-sparql-number="{{sparqlNumber}}">
            <span class="detail-progressbar__sparql-number">{{> sparql-link}}</span>
          </li>
        {{/if}}
      {{/each}}
    </ul>
    {{#if overLimit}}
      Limit the number of displayed SPARQL to {{limit}}. There are {{overLimit}} SPARQL in total.
    {{/if}}
  {{/if}}
{{/if}}
`)
