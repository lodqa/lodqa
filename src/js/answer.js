const Loader = require('./loader')
const IntegtatenDataset = require('./model/integratedDataset')
const Dataset = require('./model/dataset')
const beginSearch = require('./answer/begin-search')
const bindHandlerForKeyEvents = require('./answer/bind-handler-for-key-events')
const bindHandlerToShowSparql2 = require('./answer/bind-handler-to-show-sparql2')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')
const bindDisplayingDetailUpdateEvent = require('./controller/bind-displaying-detail-update-event')
const IntegratedAnswerIndexPresentation = require('./presentation/integrated-answer-index-presentation')

const integratedDataset = new IntegtatenDataset()
const loaders = []

for (const parent of document.querySelectorAll('.answers-for-dataset')) {
  const name = parent.getAttribute('data-dataset')
  const loader = new Loader()
  const dataset = new Dataset(name, loader, {
    endpointUrl: parent.querySelector('.answers-for-dataset__endpoint-url')
      .value,
    needProxy: parent.querySelector('.answers-for-dataset__need-proxy')
      .value === 'true'
  })

  integratedDataset.addDataset(dataset)
  loaders.push(loader)

  bindHandlerForKeyEvents(loaders)

  bindDisplayingDetailUpdateEvent(document.querySelector('.detailProgressBar'), integratedDataset, dataset)

  beginSearch(loader, 'pgp', parent, '.answers-for-dataset__mappings', dataset.name, 'read_timeout')

  bindModeButtonEventhandler('grapheditor')

  dataset.on('error', () => console.error(dataset.errorMessage))
}

new IntegratedAnswerIndexPresentation(
  document.querySelector('.integrated-answer-index'),
  integratedDataset
)

bindHandlerToShowSparql2(document, ['.integrated-answer-index', '.detailProgressBar'], 'lightbox', integratedDataset, loaders)
