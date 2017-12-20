const SummaryProgress = require('../../../model/summary-progress')
const SummaryProgressbarPresentation = require('../../../presentation/summary-progressbar-presentation')
const DatasetsProgress = require('../../../model/datasets-progress')
const DatasetsProgressbarPresentation = require('../../../presentation/datasets-progressbar-presentation')
const FilterSparqlWithAnswer = require('../../../model/filter-sparql-with-answer')
const DatasetDetailProgressbarPresentation = require('../../../presentation/dataset-detail-progressbar-presentation')

module.exports = function(loader) {
  const datasetsProgress = new DatasetsProgress(loader)
  const summaryProgress = new SummaryProgress(loader, datasetsProgress)
  new SummaryProgressbarPresentation(document.querySelector('.summary-progressbar'), summaryProgress)
  new DatasetsProgressbarPresentation(document.querySelector('.datasets-progressbar'), datasetsProgress)
  const filterSparqlWithAnswer = new FilterSparqlWithAnswer(datasetsProgress)
  new DatasetDetailProgressbarPresentation(document.querySelector('.detail-progressbar'), filterSparqlWithAnswer)

  return {
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer
  }
}
