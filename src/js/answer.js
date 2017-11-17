const Loader = require('./loader')
const IntegtatenDataset = require('./model/integratedDataset')
const Dataset = require('./model/dataset')
const beginSearch = require('./answer/begin-search')
const bindHandlerForKeyEvents = require('./answer/bind-handler-for-key-events')
const bindHandlerToShowSparql = require('./answer/bind-handler-to-show-sparql')
const createPresentations = require('./answer/create-presentations')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')
const createSimplpProgressBarOnSparqlReset = require('./controller/show-simple-progress-bar-on-sparql-reset')
const bindDisplayingDetailUpdateEvent = require('./controller/bind-displaying-detail-update-event')
const IntegratedAnswerIndexPresentation = require('./presentation/integrated-answer-index-presentation')

const integratedDataset = new IntegtatenDataset()

for (const parent of document.querySelectorAll('.answers-for-dataset')) {
  const name = parent.getAttribute('data-dataset')
  const loader = new Loader()
  const dataset = new Dataset(loader, {
    endpointUrl: parent.querySelector('.answers-for-dataset__endpoint-url')
      .value,
    needProxy: parent.querySelector('.answers-for-dataset__need-proxy')
      .value === 'true'
  })

  integratedDataset.addDataset(name, dataset)

  bindHandlerForKeyEvents(loader)

  bindHandlerToShowSparql(parent, ['.answers-for-dataset__progress-bar', '.answers-for-dataset__answer-index'], 'lightbox', dataset, loader)

  createPresentations(dataset, parent, {
    answerIndexDomSelector: '.answers-for-dataset__answer-index',
    downloadJsonButtonSelector: '.answers-for-dataset__download-json-button',
    downloadTsvButtonSelector: '.answers-for-dataset__download-tsv-button'
  })

  createSimplpProgressBarOnSparqlReset(
    parent.querySelector('.answers-for-dataset__progress-bar'),
    integratedDataset,
    name,
    dataset
  )

  new IntegratedAnswerIndexPresentation(
    document.querySelector('.integrated-answer-index'),
    integratedDataset
  )

  bindDisplayingDetailUpdateEvent(document.querySelector('.detailProgressBar'), integratedDataset, name, dataset)
  bindHandlerToShowSparql(document, ['.detailProgressBar'], 'lightbox', dataset, loader)

  beginSearch(loader, 'pgp', parent, '.answers-for-dataset__mappings', name, 'read_timeout')

  bindModeButtonEventhandler('grapheditor')

  dataset.on('error', () => console.error(dataset.errorMessage))
}
