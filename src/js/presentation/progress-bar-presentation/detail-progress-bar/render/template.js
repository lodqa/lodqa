const handlebars = require('handlebars')
const registerPartial = require('../../../../answer/register-partial')

registerPartial()

module.exports = handlebars.compile(`
  <ul class="progress-bar__detail-progress-bar__sparqls">
    {{#each sparqls}}
      <li class="
        progress-bar__detail-progress-bar__sparqls__sparql
        {{#if hasSolution}}
          {{#if uniqAnswersLength}}
            progress-bar__detail-progress-bar__sparqls__sparql--has-answer
          {{else}}
            progress-bar__detail-progress-bar__sparqls__sparql--no-answer
          {{/if}}
        {{else}}
          {{#if isProgress}}
            progress-bar__detail-progress-bar__sparqls__sparql--progress
          {{/if}}
        {{/if}}
      " data-sparql-number="{{sparqlNumber}}">
        <span class="progress-bar__detail-progress-bar__sparqls__sparql__sparql-number">{{> sparql-link}}</span>
        <span class="progress-bar__detail-progress-bar__sparqls__sparql__loading"><i class="fa fa-spinner fa-spin fa-fw"></i></span>
        <input class="progress-bar__detail-progress-bar__sparqls__sparql__selected-answers-checkbox button" type="checkbox" checked="checked" id="sparql-number-{{sparqlNumber}}">
        <label class="progress-bar__detail-progress-bar__sparqls__sparql__number-of-answers button" for="sparql-number-{{sparqlNumber}}">{{uniqAnswersLength}}</label>
      </li>
    {{else}}
    <span class="progress-bar__detail-progress-bar__sparqls__no-sparql-message">No Sparql</span>
    {{/each}}
  </ul>
`)
