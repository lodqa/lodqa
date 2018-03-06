module.exports = class AnswerContainer {
  constructor() {
    this._answers = new Map()
  }

  addAnswer(answer, datasetName, datasetNumber, sparqlNumber) {
    if (!this._answers.has(answer.uri)) {
      this._answers.set(answer.uri, Object.assign({}, answer, {
        sparqls: []
      }))
    }

    const {
      sparqls
    } = this._answers.get(answer.uri)

    // Add SPARQL of answer unless same SPARQL exits.
    if (
      sparqls.filter(({
        dataset,
        parentNumber,
        number
      }) => dataset === datasetName && parentNumber === datasetNumber && number === sparqlNumber)
        .length === 0
    ) {
      this._answers.get(answer.uri)
        .sparqls.push({
          dataset: datasetName,
          parentNumber: datasetNumber,
          number: sparqlNumber
        })
    }
  }

  get snapshot() {
    return Array.from(this._answers.values())
  }
}
