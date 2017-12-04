
module.exports = class Dataset {
  constructor(name, number) {
    this._name = name
    this._number = number
    this._sparqls = []
  }

  get name() {
    return this._name
  }

  get number() {
    return this._number
  }

  addSparql(sparql) {
    this._sparqls.push(sparql)
  }

  getSparqlNumer(sparql) {
    return this._sparqls.indexOf(sparql) + 1
  }
}
