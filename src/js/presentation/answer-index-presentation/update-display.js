const Handlebars = require('handlebars')
const registerPartial = require('../../answer/register-partial')

registerPartial()

const template = Handlebars.compile(`
  {{#each answers}}
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
`)

module.exports = function(domId, model) {
  const {
    answers
  } = model

  document.querySelector(`#${domId}`)
    .innerHTML = template({
      answers
    })
}
