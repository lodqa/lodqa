const Hogan = require('hogan.js')
const toAnswers = require('./toAnswers')

const regionHtml = `<ul class="answers-region__answers-list">
  {{#answers}}
    <li><a target="_blank" href="{{url}}" title="{{url}}">{{label}}</a></li>
  {{/answers}}
  </ul>
`
const instanceTemplate = Hogan.compile(regionHtml)

module.exports = function(solutions, focus) {
  const element = document.createElement('div')
  const answers = toAnswers(solutions, focus)

  element.innerHTML = instanceTemplate.render({
    answers
  })
  return element.children[0]
}
