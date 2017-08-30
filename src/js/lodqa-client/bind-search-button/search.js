module.exports = function(event, loader, pgpElement, mappingsElement) {
  event.target.setAttribute('disabled', 'disabled')

  const pgp = JSON.parse(pgpElement.innerHTML)
  const mappings = JSON.parse(mappingsElement.innerHTML)
  const target = document.querySelector('#target')
    .value
  const readTimeout = document.querySelector('#read_timeout')
    .value

  loader.beginSearch(pgp, mappings, '/solutions', target, readTimeout)
  loader.eventEmitter.once('ws_close', () => event.target.removeAttribute('disabled'))
}
