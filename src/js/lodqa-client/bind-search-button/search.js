const template = `<h1>Results</h1>
<div id="lodqa-results"></div>`

module.exports = function(event, loader, pgpElement, mappingsElement) {
  document.getElementById('results')
    .innerHTML = template
  event.target.setAttribute('disabled', 'disabled')

  const pgp = JSON.parse(pgpElement.innerHTML)
  const mappings = JSON.parse(mappingsElement.innerHTML)
  const config = document.querySelector('#target')
    .value

  loader.beginSearch(pgp, mappings, '/solutions', config)
  loader.eventEmitter.once('ws_close', () => event.target.removeAttribute('disabled'))
}
