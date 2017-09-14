const Handlebars = require('handlebars')
const registerPartial = require('../../answer/register-partial')

registerPartial()

const template = Handlebars.compile(`
  {{#each currentContent}}
    <div class="solution">
      <div class="answer">
        <a href="{{url}}">{{label}}</a>
      </div>
      <ul class="sparqls">
        {{#each sparqls}}
        <li class="sparql">{{> sparql-link}}</li>
        {{/each}}
      </ul>
    </div>
  {{/each}}
  {{#if isMulti}}
  <button type="button" class="button" name="prev" {{#if disablePrev}}disabled="disabled"{{/if}}>prev</button>
  {{/if}}
  {{#each pages}}
    {{#if isCurrent}}
      <strong>{{page}}</strong>
    {{else}}
      {{page}}
    {{/if}}
  {{/each}}
  {{#if isMulti}}
  <button type="button" class="button" name="next" {{#if disableNext}}disabled="disabled"{{/if}}>next</button>
  {{/if}}
`)

module.exports = function(domId, pagination) {
  document.querySelector(`#${domId}`)
    .innerHTML = template(pagination)
}
