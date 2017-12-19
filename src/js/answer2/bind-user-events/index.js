const bindModeButtonEventhandler = require('../../controller/bind-mode-button-eventhandler')
const toDownloadData = require('./to-download-data')
const tsvFormatter = require('./tsv-formatter')
const bindHandlerToShowSparql = require('./bind-handler-to-show-sparql')

module.exports = function bindUserEvents(answerSummary, summaryProgress, datasetsProgress, filterSparqlWithAnswer, sparqlInformationContainer) {
  document.addEventListener('click', ({
    target
  }) => {
    if (target.closest('.download-buttons__download-json-button')) {
      const data = toDownloadData(answerSummary)
      target.href = `data:,${encodeURIComponent(JSON.stringify(data,null, 2))}`
    }

    if (target.closest('.download-buttons__download-tsv-button')) {
      const data = toDownloadData(answerSummary)
      target.href = `data:,${encodeURIComponent(tsvFormatter(data))}`
    }
  })

  document.addEventListener('change', ({
    target
  }) => {
    if (target.closest('.summary-progressbar__checkbox')) {
      summaryProgress.showDatasets(target.checked)
    }

    if (target.closest('.datasets-progressbar__checkbox')) {
      datasetsProgress.showDataset(target.dataset.name, target.checked)
    }

    if (target.closest('.show-only-has-answers')) {
      filterSparqlWithAnswer.showOnlyWithAnswer = target.checked
    }

    if (target.closest('.detail-progress-bar__sparqls__sparql__selected-answers-checkbox')) {
      answerSummary.hideSparql(target.dataset.datasetName, target.dataset.sparqlNumber, target.checked)
      datasetsProgress.hideSparql(target.dataset.datasetName, target.dataset.sparqlNumber, target.checked)
    }
  })
  bindHandlerToShowSparql(document, 'lightbox', sparqlInformationContainer)
  bindModeButtonEventhandler('grapheditor')
}
