import bindResult from './controller/bindResult'
import Loader from './loader/loadSolution'
import anchoredPgpTablePresentation from './presentation/anchoredPgpTablePresentation'
import sparqlTablePresentation from './presentation/sparqlTablePresentation'
import solutionTablePresentation from './presentation/solutionTablePresentation'
import graphPresentation from './presentation/graphPresentation'
import websocketPresentation from './presentation/websocketPresentation'

// for debug
// import Loader from './loader/loadSolutionStub'
// import debugPresentation from './presentation/debugPresentation'

document.addEventListener('DOMContentLoaded', init)

function init() {
  const loader = new Loader()

  // bindResult.all(loader, debugPresentation)
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
    config = document.querySelector('#target').value

  loader.beginSearch(pgp, mappings, '/solutions', config)
  loader.once('ws_close', () => event.target.removeAttribute('disabled'))
}

function validateToSearch(beginSearch, pgpElement, mappingsElement) {
  const observer = new MutationObserver(() => {
    const pgp = JSON.parse(pgpElement.innerHTML),
      mappings = JSON.parse(mappingsElement.innerHTML)

    let hasTerm = false
    if (mappings) {
      Object.keys(mappings).forEach(k => {
        if (mappings[k].filter(t => t).length > 0)
          hasTerm = true
      })
    }

    if (pgp.focus && hasTerm) {
      beginSearch.removeAttribute('disabled')
    } else {
      beginSearch.setAttribute('disabled', 'disabled')
    }
  })

  const config = {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  }
  observer.observe(pgpElement, config)
  observer.observe(mappingsElement, config)
}
