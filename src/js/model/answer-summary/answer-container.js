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

    this._answers.get(answer.url)
      .sparqls.push({
        dataset: datasetName,
        parentNumber: datasetNumber,
        number: sparqlNumber
      })
  }

  get snapshot() {
    const answers = Array.from(this._answers.values())

    return answers
  }
}
