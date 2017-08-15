const show = require('./show')

module.exports = class {
  constructor(domId) {
    this.domId = domId

    // The answers is a map that has url as key and answer as value.
    // The answer is an object that has a url, a label and an array of sparql.
    this.answers = new Map()
  }

  show(data, sparqlNumber, focusNode) {
    show(this.domId, this.answers, data, sparqlNumber, focusNode)
  }
}
