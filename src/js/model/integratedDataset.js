const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor() {
    super()

    this._datasets = new Map()
    this._datasetsOrder = []
  }

  getDataset(datasetNumber) {
    return this._datasetsOrder[datasetNumber - 1].dataset
  }

  addDataset(datasetName, dataset) {
    this._datasets.set(datasetName, dataset)
    this._datasetsOrder.push({
      datasetName,
      dataset
    })

    // Listen dataset
    dataset.on('sparql_reset_event', () => this.emit('answer_index_update_event'))
    dataset.on('answer_index_add_event', () => this.emit('answer_index_update_event'))
    dataset.on('answer_index_update_event', () => this.emit('answer_index_update_event'))
    dataset.on('label_update_event', () => this.emit('answer_index_update_event'))
  }

  // For example
  // {
  //   datasets: ['QALD-BioMed', 'bio2rdf-mashup'],
  //   answers: [{
  //     'label': 'EDNRB',
  //     'url': 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/genes/EDNRB',
  //     datasets: [{
  //       'sparqls': [{
  //         'sparqlNumber': 4
  //       }, {
  //         'sparqlNumber': 5
  //       }, {
  //         'sparqlNumber': 6
  //       }]
  //     }, {}]
  //   }, {
  //     'label': 'BBBBBB',
  //     'url': 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/genes/EDNRB',
  //     datasets: [{}, {
  //       'sparqls': [{
  //         'sparqlNumber': 4
  //       }, {
  //         'sparqlNumber': 5
  //       }, {
  //         'sparqlNumber': 6
  //       }]
  //     }]
  //   }, {
  //     'label': 'DDDDDDD',
  //     'url': 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/genes/EDNRB',
  //     datasets: [{
  //       'sparqls': [{
  //         'sparqlNumber': 4
  //       }, {
  //         'sparqlNumber': 5
  //       }, {
  //         'sparqlNumber': 6
  //       }]
  //     }, {
  //       'sparqls': [{
  //         'sparqlNumber': 4
  //       }, {
  //         'sparqlNumber': 5
  //       }, {
  //         'sparqlNumber': 6
  //       }]
  //     }]
  //   }]
  // }
  get integratedAnswerIndex() {
    // Show only datasets with answers.
    const datasets = this._datasetsOrder
      .filter(d => d.dataset.sparqlsMax)
      .map(d => ({
        name: d.datasetName,
        value: d.dataset.sparqlCount,
        max: d.dataset.sparqlsMax,
        percetage: Math.floor(d.dataset.sparqlCount / d.dataset.sparqlsMax * 1000) / 10
      }))

    // Concat answers. Do not merge yet.
    const integratedAnswers = this._datasetsOrder
      .map(o => o.dataset)
      .reduce((ary, elm) => ary.concat(elm.answerIndex.map(a => ({
        label: a.label,
        url: a.url
      }))), [])

    // Aggregate answers from each datasets
    const answers = aggregateAnswers(integratedAnswers, this._datasetsOrder)

    return {
      datasets,
      answers
    }
  }

  set displayingDetail(datasetName) {
    this.emit('dataset_displaying_detail_update_event', datasetName, this._datasets.get(datasetName))
  }
}

function aggregateAnswers(integratedAnswers, datasetsOrder) {
  return integratedAnswers.map(answer => Object.assign(answer, {
    datasets: getDatasetsForAnswer(answer, datasetsOrder)
  }))
}

function getDatasetsForAnswer(answer, datasetsOrder) {
  return datasetsOrder.map(({
    dataset
  }, index) => ({
    sparqls: getSparqlsForAnswer(dataset.answerIndex, answer, index)
  }))
}

function getSparqlsForAnswer(answerIndex, answer, index) {
  return answerIndex
    .filter(a => a.label === answer.label)
    .map(a => a.sparqls.map(s => ({
      sparqlNumber: `${index + 1}-${s.sparqlNumber}`
    })))[0]
}
