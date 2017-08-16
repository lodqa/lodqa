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

module.exports = function(domId, answersMap, hideSparqls) {
  const answers = Array.from(answersMap.values())
  const hoge = answers.map((a) => Object.assign({}, a, {
    sparqls: a.sparqls.filter((sparql) => !hideSparqls.has(sparql.name.substr(1)))
  }))

  document.querySelector(`#${domId}`)
    .innerHTML = template({
      answers: hoge
    })
}
