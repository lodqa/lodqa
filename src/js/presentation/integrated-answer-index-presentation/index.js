const handlebars = require('handlebars')
const template = require('./template')
const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')

const tsvFormatter = handlebars.compile(`{{#each this}}
{{label}}	{{url}}
{{/each}}
`)

module.exports = class {
  constructor(dom, integratedDataset) {
    this._dom = dom
    this._integratedDataset = integratedDataset

    integratedDataset.on('answer_index_update_event', () => this.render())

    // To switch showing detail of progress
    const onClickDetailCheckbox = (event) => integratedDataset.displayingDetail = (event.target.checked ? event.target.dataset.name : '')
    bindHandlerToCheckbox(dom, '.show-detail-progress-bar', onClickDetailCheckbox)

    dom.addEventListener('click', (e) => {
      if (e.target.closest('.answers-for-dataset__download-json-button')) {
        e.target.href = `data:,${encodeURIComponent(JSON.stringify(getData(integratedDataset),null, 2))}`
      }

      if (e.target.closest('.answers-for-dataset__download-tsv-button')) {
        e.target.href = `data:,${encodeURIComponent(tsvFormatter(getData(integratedDataset)))}`
      }
    })
  }

  render() {
    const before = this._dom.innerHTML
    const after = template(this._integratedDataset.integratedAnswerIndex)
    if (before !== after) {
      this._dom.innerHTML = after
    }
  }
}

function getData(integratedDataset) {
  const {
    answers
  } = integratedDataset.integratedAnswerIndex
  const data = answers.map(a => ({
    url: a.url,
    label: a.label
  }))
  return data
}
