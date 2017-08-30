const hasFocus = require('./has-focus')
const hasTerm = require('./has-term')

module.exports = function enableIfValid(beginSearch, pgpElement, mappingsElement, runner) {
  if (hasFocus(pgpElement) && hasTerm(mappingsElement)) {
    runner.classList.remove('hidden')
    beginSearch.removeAttribute('disabled')
  } else {
    beginSearch.setAttribute('disabled', 'disabled')
    runner.classList.add('hidden')
  }
}
