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

module.exports = function(domId, answersMap, hideSparqls) {
  const originalAnswers = Array.from(answersMap.values())

  // Hide answers accoding to the hidelSparqls
  const answers = originalAnswers.map((a) => Object.assign({}, a, {
    sparqls: a.sparqls.filter((sparql) => !hideSparqls.has(sparql.sparqlNumber.toString()))
  }))

  document.querySelector(`#${domId}`)
    .innerHTML = template({
      answers
    })
}
