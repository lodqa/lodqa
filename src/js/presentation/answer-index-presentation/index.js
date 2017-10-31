const updateDisplay = require('./update-display')
const Pagenation = require('./Pagenation')

module.exports = class {
  constructor(parent, domSelector) {
    this.parent = parent
    this.domSelector = domSelector
    this.pagination = new Pagenation(16)

    parent.querySelector(`${this.domSelector}`)
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

    updateDisplay(this.parent, this.domSelector, this.pagination.dump)
  }

  prev() {
    if (this.pagination.goPrev()) {
      updateDisplay(this.parent, this.domSelector, this.pagination.dump)
    }
  }

  next() {
    if (this.pagination.goNext()) {
      updateDisplay(this.parent, this.domSelector, this.pagination.dump)
    }
  }
}
