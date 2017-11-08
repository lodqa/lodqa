const updateDisplay = require('./update-display')
const Pagenation = require('./Pagenation')

module.exports = class {
  constructor(dom) {
    this._dom = dom
    this._pagination = new Pagenation(16)

    this._dom
      .addEventListener('click', (e) => {
        if (e.target.name === 'prev') {
          this.prev()
        }
        if (e.target.name === 'next') {
          this.next()
        }
      })
  }

  updateDisplay(model) {
    this.answers = model.answers
    this._pagination.items = model.answers

    updateDisplay(this._dom, this._pagination.dump)
  }

  prev() {
    if (this._pagination.goPrev()) {
      updateDisplay(this._dom, this._pagination.dump)
    }
  }

  next() {
    if (this._pagination.goNext()) {
      updateDisplay(this._dom, this._pagination.dump)
    }
  }
}
