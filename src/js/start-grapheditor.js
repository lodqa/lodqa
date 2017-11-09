const Loader = require('./loader/load-solution')
const Model = require('./model')
const bindSearchButton = require('./grapheditor/bind-search-button')
const bindStopSearchButton = require('./grapheditor/bind-stop-search-button')
const bindLoaderEvents = require('./grapheditor/bind-loader-events')
const ProgressBarPresentation = require('./presentation/progress-bar-presentation')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const isVerbose = {
    value: false
  }
  const model = new Model(loader)
  const progressBarPresentation = new ProgressBarPresentation(
    document.querySelector('#progress-bar'),
    model
  )

  bindLoaderEvents(loader, 'lodqa-results', 'lodqa-messages', isVerbose, model, progressBarPresentation)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => isVerbose.value = event.target.checked)
}
