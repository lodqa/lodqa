const Loader = require('./loader/load-solution')
const bindSearchButton = require('./lodqa-client/bind-search-button')
const bindStopSearchButton = require('./lodqa-client/bind-stop-search-button')
const bindLoaderEvents = require('./lodqa-client/bind-loader-events')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const isVerbose = {
    value: false
  }

  bindLoaderEvents(loader, 'lodqa-results', 'lodqa-messages', isVerbose)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => isVerbose.value = event.target.checked)
}
