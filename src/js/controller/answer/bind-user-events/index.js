const bindModeSwitchEventhandler = require('../../../controller/bind-mode-switch-eventhandler')
const toDownloadData = require('./to-download-data')
const tsvFormatter = require('./tsv-formatter')
const bindHandlerToShowSparql = require('./bind-handler-to-show-sparql')

module.exports = function bindUserEvents(answerSummary, answerMedia, summaryProgress, datasetsProgress, filterSparqlWithAnswer, sparqlInformationContainer) {
  document.addEventListener('click', ({
    target
  }) => {
    if (target.closest('.download-answers__download-button')) {
      const data = toDownloadData(answerSummary)

      const [select] = target.nextElementSibling.children
      let formmated
      switch (select.value) {
      case 'json':
        formmated = encodeURIComponent(JSON.stringify(data, null, 2))
        break
      case 'tsv':
        formmated = encodeURIComponent(tsvFormatter(data))
        break
      default:
        console.error(`${target.value} is not supported format.`)
      }

      // Do download.
      target.href = `data:,${formmated}`
      target.download = `lodqa-download.${select.value}`
    }
  })

  document.addEventListener('change', ({target}) => {
    if (target.closest('.summary-progressbar__checkbox')) {
      summaryProgress.showDatasets(target.checked)
    }

    if (target.closest('.datasets-progressbar__checkbox')) {
      datasetsProgress.showDataset(target.dataset.name, target.checked)
    }

    if (target.closest('.show-only-has-answers')) {
      filterSparqlWithAnswer.showOnlyWithAnswer = target.checked
    }

    if (target.closest('.detail-progressbar__sparql__selected-answers-checkbox')) {
      answerSummary.hideSparql(target.dataset.datasetName, target.dataset.sparqlNumber, target.checked)
      datasetsProgress.hideSparql(target.dataset.datasetName, target.dataset.sparqlNumber, target.checked)
    }
  }, true)

  document.addEventListener('mouseenter', ({target}) => {
    if (target.nodeType ===1 && target.closest('.answer-summary__answer-url')) {
      const answerUrl = target.closest('.answer-summary__answer-url')
      if(answerUrl.dataset.rendering){
        console.log('hi', answerUrl.dataset.answerUri, answerUrl.dataset.urlIndex)
        answerMedia.select(answerUrl.dataset.answerUri, answerUrl.dataset.urlIndex)
      }
    }
  }, true)

  bindHandlerToShowSparql(document, 'lightbox', sparqlInformationContainer)
  bindModeSwitchEventhandler('grapheditor')
}
