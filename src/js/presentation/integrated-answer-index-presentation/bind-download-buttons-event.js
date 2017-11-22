const handlebars = require('handlebars')
const getData = require('./get-data')

const tsvFormatter = handlebars.compile(`{{#each this}}
{{label}}	{{url}}
{{/each}}
`)

module.exports = function(dom, integratedDataset) {
  dom.addEventListener('click', (e) => {
    if (e.target.closest('.answers-for-dataset__download-json-button')) {
      e.target.href = `data:,${encodeURIComponent(JSON.stringify(getData(integratedDataset),null, 2))}`
    }

    if (e.target.closest('.answers-for-dataset__download-tsv-button')) {
      e.target.href = `data:,${encodeURIComponent(tsvFormatter(getData(integratedDataset)))}`
    }
  })
}
