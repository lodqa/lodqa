const getNumberOfAnswers = require('../get-number-of-answers')

module.exports = function(dom, uniqAnswersLength) {
  getNumberOfAnswers(dom)
    .innerHTML = uniqAnswersLength

  if (uniqAnswersLength) {
    dom.classList.add('progress-bar__detail-progress-bar__sparqls__sparql--has-answer')
  } else {
    dom.classList.add('progress-bar__detail-progress-bar__sparqls__sparql--no-answer')
  }
}
