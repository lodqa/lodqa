module.exports = function(event, loader, pgpElement, mappingsElement) {
  document.querySelector('#lodqa-results')
    .innerHTML = ''
  event.target.setAttribute('disabled', 'disabled')

  const pgp = JSON.parse(pgpElement.innerHTML)
  const mappings = JSON.parse(mappingsElement.innerHTML)
  const target = document.querySelector('#target')
    .value
  const readTimeout = document.querySelector('#read-timeout')
    .value
  const sparqlLimit = document.querySelector('#sparql-limit')
    .value
  const answerLimit = document.querySelector('#answer-limit')
    .value

  loader.beginSearch(pgp, mappings, '/solutions', target, readTimeout, sparqlLimit, answerLimit)
  loader.once('expert:ws_close', () => event.target.removeAttribute('disabled'))
}
