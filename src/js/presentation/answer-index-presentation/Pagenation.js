module.exports = class {
  constructor (answersPerPage) {
    this._answerPerPage = answersPerPage
    this._currentPage = 1
  }

  set items(items) {
    this._items = items

    const maxPageNumber = Math.ceil(this._items.length / this._answerPerPage)
    this._maxPageNumber = maxPageNumber
  }

  goPrev() {
    if (this._currentPage > 1) {
      this._currentPage--
      return true
    }
  }

  goNext() {
    if (this._currentPage < this._maxPageNumber) {
      this._currentPage++
      return true
    }
  }

  get dump() {
    if (this._maxPageNumber > 1) {
      return {
        isMulti: true,
        disablePrev: this._currentPage === 1,
        disableNext: this._currentPage === this._maxPageNumber,
        pages: Array.from(Array(this._maxPageNumber).keys())
          .map((page) => ({
            page: page + 1,
            isCurrent: page + 1 === this._currentPage
          })),
        currentContent: this._items.slice((this._currentPage - 1) * this._answerPerPage, this._currentPage * this._answerPerPage)
      }
    }

    return {
      currentContent: this._items.slice((this._currentPage - 1) * this._answerPerPage, this._currentPage * this._answerPerPage)
    }
  }
}
