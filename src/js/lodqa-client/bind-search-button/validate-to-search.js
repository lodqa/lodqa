const enableIfValid = require('./enable-if-valid')

module.exports = function(beginSearch, pgpElement, mappingsElement, runner) {
  const enableSearchButton = () => enableIfValid(beginSearch, pgpElement, mappingsElement, runner)
  const observer = new MutationObserver(enableSearchButton)

  enableSearchButton()

  const config = {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  }
  observer.observe(pgpElement, config)
  observer.observe(mappingsElement, config)
}
