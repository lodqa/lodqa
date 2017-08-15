const Handlebars = require('handlebars')

const template = Handlebars.compile(`
  {{#each answers}}
    <div class="solution">
      <div class="answer">
        <a href="{{url}}">{{label}}</a>
      </div>
      <ul class="sparqls">
        {{#each sparqls}}
        <li class="sparql"><span title="{{sparql}}">{{name}}</span></li>
        {{/each}}
      </ul>
    </div>
  {{/each}}
`)

module.exports = function(domId, answersMap) {
  const answers = Array.from(answersMap.values())

  document.querySelector(`#${domId}`)
    .innerHTML = template({
      answers
    })
}
