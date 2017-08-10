const Handlebars = require('handlebars')
const findLabel = require('../find-label')
const updateAnswers = require('./update-answers')
const getUniqAnswers = require('../get-uniq-answers')

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

// The answers is a map that has url as key and answer as value.
// The answer is an object that has a url, a label and an array of sparql.
const answers = new Map()

function updateDisplay(domId, answers) {
  document.querySelector(`#${domId}`)
    .innerHTML = template({
      answers
    })
}

module.exports = function (domId, data, sparqlCount, focusNode) {
  const uniqAnswers = getUniqAnswers(data.solutions, focusNode)

  updateAnswers(
    answers,
    uniqAnswers,
    sparqlCount,
    data.sparql
  )

  updateDisplay(domId, Array.from(answers.values()))

  findLabel(uniqAnswers.map((answer) => answer.url), (url, label) => {
    answers.get(url)
      .label = label
    updateDisplay(domId, Array.from(answers.values()))
  })
}
