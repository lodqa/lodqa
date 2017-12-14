module.exports = class AnswerContainer {
  constructor() {
    this._answers = new Map()
  }

  addAnswer(answer, datasetName, datasetNumber, sparqlNumber) {
    if (!this._answers.has(answer.url)) {
      this._answers.set(answer.url, {
        label: answer.label,
        url: answer.url,
        sparqls: []
      })
    }

    const {
      sparqls
    } = this._answers.get(answer.url)

    // Add SPARQL of answer unless same SPARQL exits.
    if (
      sparqls.filter(({
        dataset,
        parentNumber,
        number
      }) => dataset === datasetName && parentNumber === datasetNumber && number === sparqlNumber)
        .length === 0
    ) {
      this._answers.get(answer.url)
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
