const handlebars = require('handlebars')
const registerPartial = require('../../../answer/register-partial')

registerPartial()

module.exports = handlebars.compile(`
  <div class="detail-progress-bar">
    <div>
        <span class="detail-progress-bar__dataset-name" data-dataset-name="{{name}}">{{name}}</span>
        <input type="checkbox" id="show-only-has-answers-{{name}}" class="show-only-has-answers">
        <label for="show-only-has-answers-{{name}}">Show only sparqls with answers</label>
    </div>
    <ul class="detail-progress-bar__sparqls">
      {{#each sparqls}}
        {{#if error}}
          <li class="
            detail-progress-bar__sparqls__sparql
            detail-progress-bar__sparqls__sparql--error
          " data-sparql-number="{{sparqlNumber}}">
            <span class="detail-progress-bar__sparqls__sparql__sparql-number">{{> sparql-link}}</span>
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
            <span class="detail-progress-bar__sparqls__sparql__sparql-number">{{> sparql-link}}</span>
            <input
              class="detail-progress-bar__sparqls__sparql__selected-answers-checkbox button"
              type="checkbox"
              {{#if visible}}
                checked="checked"
              {{/if}}
              id="sparql-number-{{sparqlNumber}}">
            <label class="detail-progress-bar__sparqls__sparql__number-of-answers button" for="sparql-number-{{sparqlNumber}}">{{uniqAnswersLength}}</label>
          </li>
        {{else if isProgress}}
          <li class="
            detail-progress-bar__sparqls__sparql
            detail-progress-bar__sparqls__sparql--progress
          " data-sparql-number="{{sparqlNumber}}">
            <span class="detail-progress-bar__sparqls__sparql__sparql-number">{{> sparql-link}}</span>
            <span class="detail-progress-bar__sparqls__sparql__loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
          </li>
        {{else}}
          <li class="
            detail-progress-bar__sparqls__sparql
            {{#if isProgress}}
              detail-progress-bar__sparqls__sparql--progress
            {{/if}}
          " data-sparql-number="{{sparqlNumber}}">
            <span class="detail-progress-bar__sparqls__sparql__sparql-number">{{> sparql-link}}</span>
          </li>
        {{/if}}
      {{else}}
      <span class="detail-progress-bar__sparqls__no-sparql-message">No Sparql</span>
      {{/each}}
    </ul>
  </div>
`)
