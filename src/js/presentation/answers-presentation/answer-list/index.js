const handlebars = require('handlebars')
const createDom = require('../../create-dom')
const toAnswers = require('./to-answers')

const regionHtml = `<ul class="answers-region__answers-list">
  {{#answers}}
    <li><a target="_blank" href="{{url}}" title="{{url}}">{{label}}</a></li>
  {{/answers}}
  </ul>
`
const instanceTemplate = handlebars.compile(regionHtml)

module.exports = function(solutions, focus) {
  const answers = toAnswers(solutions, focus)
  const dom = createDom(instanceTemplate({
    answers
  }))

  return {
    dom,
    updateLabel: (url, label) => updateLabel(dom, url, label)
  }
}

function updateLabel(dom, url, label) {
  for (const anchor of dom.querySelectorAll('a')) {
    if(anchor.href === url && anchor.innerText !==label){
      anchor.innerText = label
    }
  }
}
