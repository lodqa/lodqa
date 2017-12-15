const getUniqAnswers = require('../get-uniq-answers')

module.exports = class {
  constructor(name) {
    this.name = name

    this._bgps = []
    this._progress = null
    this._solutions = []

    this.max = 0
    this.value = 0
    this.show = false
  }

  addBgp(bgp) {
    this._bgps.push(bgp)

    if (this._bgps.length && !this._progress) {
      this._progress = this._bgps.shift()
    }

    this.max += 1
  }

  addSolutions(error, anchoredPgp, bgp, solutions) {
    const expectedBgp = this._progress

    if (JSON.stringify(bgp) !== JSON.stringify(expectedBgp)) {
      console.warn('bpg mismatch!', bgp, expectedBgp)
    }

    this._solutions.push({
      error,
      answers: getUniqAnswers(solutions, anchoredPgp.focus),
      visible: true
    })

    this._progress = this._bgps.shift()
    this.value += 1
  }

  hideSparql(sparqlNumber, visible) {
    this._solutions[sparqlNumber - 1].visible = visible
  }

  get percentage() {
    return Math.floor(this.value / this.max * 1000) / 10
  }

  get snapshot() {
    return this._solutions.map(s => ({
      hasSolution: true,
      uniqAnswersLength: s.answers.length,
      visible: s.visible,
      error: s.error
    }))
      .concat(this._progress ? [{
        hasSolution: false,
        isProgress: true
      }] : [])
      .concat(this._bgps.map(() => ({
        hasSolution: false
      })))
      .map((s, index) => Object.assign(s, {
        datasetName: this.name,
        sparqlNumber: index + 1,
        sparqlName: index + 1,
      }))
  }
}
