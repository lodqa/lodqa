const bindModeSwitchEventhandler = require('../../../controller/bind-mode-switch-eventhandler')
const toDownloadData = require('./to-download-data')
const tsvFormatter = require('./tsv-formatter')
const bindHandlerToShowSparql = require('./bind-handler-to-show-sparql')

module.exports = function bindUserEvents(answerSummary, mediaSelect, summaryProgress, datasetsProgress, filterSparqlWithAnswer, sparqlInformationContainer) {
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

    if (target.closest('.detail-progressbar__sparql__selected-answers-checkbox')) {
      const {
        datasetName,
        sparqlNumber
      } = target.dataset

      answerSummary.hideSparql(datasetName, sparqlNumber, target.checked)
      datasetsProgress.hideSparql(datasetName, sparqlNumber, target.checked)
    }
  })

  document.addEventListener('mouseover', ({
    target
  }) => {
    if (target.nodeType === 1 && target.closest('.answer-summary__answer-url')) {
      const answerUrl = target.closest('.answer-summary__answer-url')
      if (answerUrl.dataset.answerUri) {
        const {
          answerUri,
          urlIndex
        } = answerUrl.dataset

        mediaSelect.select(answerUri, Number(urlIndex))
      }
    }
  })

  bindHandlerToShowSparql(document, 'lightbox', sparqlInformationContainer)
  bindModeSwitchEventhandler('grapheditor')
}
