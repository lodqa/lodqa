module.exports = class {
  constructor(anchoredPgp, sparql) {
    this.anchoredPgp = anchoredPgp
    this.sparql = sparql
  }

  extend(options) {
    return Object.assign(this, options)
  }

  append(answers) {
    return Object.assign(this, {
      answers: (this.answers || [])
        .concat(answers)
    })
  }
}
