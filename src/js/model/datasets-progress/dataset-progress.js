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

  addBgps(bgps) {
    this._bgps = this._bgps.concat(bgps)

    if (this._bgps.length && !this._progress) {
      this._progress = this._bgps.shift()
    }

    this.max += bgps.length
  }

  addSolutions(error, anchoredPgp, bgp, solutions) {
    const expectedBgp = this._progress

    if (JSON.stringify(bgp) !== JSON.stringify(expectedBgp)) {
      console.warn('bpg mismatch!', bgp, expectedBgp)
    }

    this._solutions.push({
      error,
      answers: getUniqAnswers(solutions, anchoredPgp.focus)
    })

    this._progress = this._bgps.shift()
    this.value += 1
  }

  get percentage() {
    return Math.floor(this.value / this.max * 1000) / 10
  }

  get snapshot() {
    return this._solutions.map(s => ({
      hasSolution: true,
      uniqAnswersLength: s.answers.length,
      visible: true,
      error: s.error
    }))
      .concat([{
        hasSolution: false,
        isProgress: true
      }])
      .concat(this._bgps.map(() => ({
        hasSolution: false
      })))
  }
}
