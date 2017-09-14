const updateDisplay = require('./update-display')
const Pagenation = require('./Pagenation')

module.exports = class {
  constructor(domId) {
    this.domId = domId
    this.pagination = new Pagenation(16)

    document.querySelector(`#${this.domId}`)
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
    this.pagination.items = model.answers

    updateDisplay(this.domId, this.pagination.dump)
  }

  prev() {
    if (this.pagination.goPrev()) {
      updateDisplay(this.domId, this.pagination.dump)
    }
  }

  next() {
    if (this.pagination.goNext()) {
      updateDisplay(this.domId, this.pagination.dump)
    }
  }
}
