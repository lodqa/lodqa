const Hogan = require('Hogan.js')
const toAnswers = require('./toAnswers')

const regionHtml = `<ul class="answer-list">
  {{#answers}}
    <li>{{label}}</li>
  {{/answers}}
  </ul>
`
const instanceTemplate = Hogan.compile(regionHtml)

module.exports = function(solutions, focus) {
  const answers = toAnswers(solutions, focus)

  return instanceTemplate.render({
    answers
  })
}
