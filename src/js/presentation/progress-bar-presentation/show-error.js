const getNumberOfAnswers = require('./get-number-of-answers')

module.exports = function(dom, errorMessage) {
  getNumberOfAnswers(dom)
    .innerHTML = `<i class="fa fa-bomb" aria-hidden="true" title="${errorMessage}"></i>`

  dom.classList.add('progress-bar__detail-progress-bar__sparqls__sparql--error')
}
