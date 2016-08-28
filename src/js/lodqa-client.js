import bindResult from './controller/bindResult'
import Loader from './loader/loadSolution'
import anchoredPgpTablePresentation from './presentation/anchoredPgpTablePresentation'
import sparqlTablePresentation from './presentation/sparqlTablePresentation'
import solutionTablePresentation from './presentation/solutionTablePresentation'
import graphPresentation from './presentation/graphPresentation'
import websocketPresentation from './presentation/websocketPresentation'

document.addEventListener('DOMContentLoaded', init)

function init() {
  const loader = new Loader()

  bindResult.anchoredPgp(loader, anchoredPgpTablePresentation)
  bindResult.all(loader, sparqlTablePresentation)
  bindResult.all(loader, solutionTablePresentation)
  bindResult.all(loader, graphPresentation)

  bindWebsocketPresentation(loader)
  bindParseRenderingPresentation(loader)

  const beginSearch = document.querySelector('#beginSearch'),
    pgpElement = document.querySelector('.pgp'),
    mappingsElement = document.querySelector('.mappings')

  beginSearch
    .addEventListener('click', (e) => search(e, loader, pgpElement, mappingsElement))

  validateToSearch(beginSearch, pgpElement, mappingsElement)
}

function bindWebsocketPresentation(loader) {
  const presentation = websocketPresentation('lodqa-messages')
  loader
    .on('ws_open', presentation.onOpen)
    .on('ws_close', presentation.onClose)
}

function bindParseRenderingPresentation(loader) {
  loader.on('parse_rendering', function(data) {
    document.getElementById('lodqa-parse_rendering').innerHTML = data
  })
}

function search(event, loader, pgpElement, mappingsElement) {
  document.getElementById('results').innerHTML = '<h1>Results</h1><div id="lodqa-results"></div>'
  event.target.setAttribute('disabled', 'disabled')

  const pgp = JSON.parse(pgpElement.innerHTML),
    mappings = JSON.parse(mappingsElement.innerHTML),
    config = document.querySelector('#target').value,
    verbose = event.target.nextElementSibling.children[0].checked

  loader.beginSearch(pgp, mappings, '/solutions', config, verbose)
  loader.once('ws_close', () => event.target.removeAttribute('disabled'))
}

function validateToSearch(beginSearch, pgpElement, mappingsElement) {
  const enableSearchButton = () => enableIfValid(beginSearch, pgpElement, mappingsElement),
    observer = new MutationObserver(enableSearchButton)

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

function enableIfValid(beginSearch, pgpElement, mappingsElement) {
  if (hasFocus(pgpElement) && hasTerm(mappingsElement)) {
    beginSearch.removeAttribute('disabled')
  } else {
    beginSearch.setAttribute('disabled', 'disabled')
  }
}

function hasFocus(pgpElement) {
  if (!pgpElement.innerHTML) {
    return false
  }

  const pgp = JSON.parse(pgpElement.innerHTML)

  return Boolean(pgp.focus)
}

function hasTerm(mappingsElement) {
  if (!mappingsElement.innerHTML) {
    return false
  }

  const mappings = JSON.parse(mappingsElement.innerHTML)

  let hasTerm = Object.keys(mappings)
    .filter((key) => mappings[key].filter((term) => term).length > 0)

  return Boolean(hasTerm.length)
}
