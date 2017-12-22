const bindSearch = require('./bind-search')
const validateToSearch = require('./validate-to-search')

module.exports = function(loader) {
  const beginSearch = document.querySelector('#begin-search')
  const pgpElement = document.querySelector('.pgp')
  const mappingsElement = document.querySelector('.mappings')
  const runner = document.querySelector('#runner')

  validateToSearch(beginSearch, pgpElement, mappingsElement, runner)
  bindSearch(beginSearch, loader, pgpElement, mappingsElement)
}
