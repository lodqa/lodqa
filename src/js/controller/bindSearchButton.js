module.exports = function(loader) {
  const beginSearch = document.querySelector('#beginSearch'),
    pgpElement = document.querySelector('.pgp'),
    mappingsElement = document.querySelector('.mappings'),
    runner = document.querySelector('#runner')

  validateToSearch(beginSearch, pgpElement, mappingsElement, runner)
  bindSearch(beginSearch, loader, pgpElement, mappingsElement)
}

function bindSearch(beginSearch, loader, pgpElement, mappingsElement) {
  beginSearch
    .addEventListener('click', (e) => {
      e.target.classList.toggle('hidden')
      document.querySelector('#stopSearch').classList.toggle('hidden')

      document.querySelector('.dashboard').classList.add('dashboard--back')
      document.querySelector('.results').classList.remove('results--hidden', 'results--back')
      document.querySelector('.results').classList.remove('results--back')
      e.stopPropagation()

      search(e, loader, pgpElement, mappingsElement)
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

function validateToSearch(beginSearch, pgpElement, mappingsElement, runner) {
  const enableSearchButton = () => enableIfValid(beginSearch, pgpElement, mappingsElement, runner),
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

function enableIfValid(beginSearch, pgpElement, mappingsElement, runner) {
  if (hasFocus(pgpElement) && hasTerm(mappingsElement)) {
    runner.classList.remove('hidden')
    beginSearch.removeAttribute('disabled')
  } else {
    beginSearch.setAttribute('disabled', 'disabled')
    runner.classList.add('hidden')
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
