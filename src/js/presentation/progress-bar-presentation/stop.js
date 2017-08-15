const getCurrentSparql = require('./get-current-sparql')

module.exports = function stop(domId, sparqlCount, errorMessage = '') {
  // The sparql count must be incremented because the next solution is not arrived yet.
  const current = getCurrentSparql(domId, sparqlCount + 1)

  if (current) {
    // If there is errorMessage, show it with a bomb icon.
    if (errorMessage) {
      current.querySelector('.number-of-answers')
        .innerHTML = `<i class="fa fa-bomb" aria-hidden="true" title="${errorMessage}"></i>`
    } else {
      // If a conneciton of websocket is closed, hide the spinner icon
      if (!current.querySelector('.fa-bomb')) {
        current.querySelector('.number-of-answers')
          .innerHTML = ''
      }
    }
  }
}
