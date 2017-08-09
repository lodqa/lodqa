const Handlebars = require('handlebars')
const findLabel = require('../find-label')
const updateAnswers = require('./update-answers')
const getUniqAnswers = require('./get-uniq-answers')

const privateData = {}
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

class AnswerIndexPresentation {
  setAnchoredPgp(domId, anchored_pgp) {
    privateData.anchoredPgp = anchored_pgp
  }

  show(domId, data, sparqlCount) {
    const uniqAnswers = getUniqAnswers(data.solutions, privateData.anchoredPgp.focus)

    updateAnswers(
      answers,
      uniqAnswers,
      sparqlCount,
      data.sparql
    )

    updateDisplay(domId, answers)

    findLabel(uniqAnswers.map((answer) => answer.url), (url, label) => {
      answers.get(url).label = label
      updateDisplay(domId, answers)
    })
  }
}

function updateDisplay(domId, answers){
  document.querySelector(`#${domId}`)
    .innerHTML = template({
      answers: Array.from(answers.values())
    })
}

module.exports = new AnswerIndexPresentation
