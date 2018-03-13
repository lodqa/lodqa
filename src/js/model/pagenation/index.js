const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(answerSummary) {
    super()

    this._itemsPerPage = 5
    this._answerSummary = answerSummary
    this._currentPage = 1
    this._maxPageNumber = 0

    answerSummary.on('answer_summary_update_event', () => {
      this._page = answerSummary.snapshot.length
      this.emit('answer_summary_update_event')
    })
  }

  set _page(itemCount) {
    const maxPageNumber = Math.ceil(itemCount / this._itemsPerPage)

    if (this._maxPageNumber !== maxPageNumber) {
      this._maxPageNumber = maxPageNumber
      if (this._maxPageNumber < this._currentPage) {
        this._currentPage = this._maxPageNumber
      }
      this.emit('answer_summary_page_update_event')
    }
  }

  goPrev() {
    if (1 < this._currentPage) {
      this._currentPage -= 1
      this.emit('answer_summary_update_event')
      this.emit('answer_summary_page_update_event')
    }
  }

  goNext() {
    if (this._currentPage < this._maxPageNumber) {
      this._currentPage += 1
      this.emit('answer_summary_update_event')
      this.emit('answer_summary_page_update_event')
    }
  }

  goPage(newPage) {
    if (1 <= newPage && newPage <= this._maxPageNumber) {
      this._currentPage = newPage
      this.emit('answer_summary_update_event')
      this.emit('answer_summary_page_update_event')
    }
  }

  get pages() {
    if (this._maxPageNumber < 2) {
      return
    }

    return {
      enablePrev: this._currentPage !== 1,
      enableNext: this._currentPage !== this._maxPageNumber,
      pages: limitDisplayNumburOfPagesTo10(this._maxPageNumber, this._currentPage)
    }
  }

  get snapshot() {
    return this._currentPageContent
  }

  get _currentPageContent() {
    return this._answerSummary.snapshot.slice((this._currentPage - 1) * this._itemsPerPage, this._currentPage * this._itemsPerPage)
  }
}

// Limeit display number of pages when number of pages is more than 10.
function limitDisplayNumburOfPagesTo10(maxPageNumber, currentPage) {
  // Return a page list containing 1 to maxPageNumber when number of pages is less than 10
  if (maxPageNumber <= 10) {
    return Array
      .from(Array(maxPageNumber)
        .keys())
      .map((offset) => offset + 1)
      .map((page) => ({
        page,
        isCurrent: page === currentPage
      }))
  }

  return Array
    .from(Array(10)
      .keys())
    .map((offset) => {
      // Return a page list containing 1 to 10 when curret pages is less than 6
      // ex. ^1, 2, 3, 4, 5, *6*, 7, 8, 9, 10
      if (currentPage <= 6) {
        return 1 + offset
      }

      // Return a page list containing maxPageNumber - 9 to maxPageNumber when number of page after curret pages is less than 4
      // ex. 3, 4, 5, 6, 7, *8*, 9, 10, 11, 12$
      if (maxPageNumber - currentPage <= 4) {
        return maxPageNumber - 9 + offset
      }

      // Return a page list containing currentPage - 5 to currentPage + 3
      // ex. 2, 3, 4, 5, 6, *7*, 8, 9, 10, 11
      return currentPage - 5 + offset
    })
    .map((page) => ({
      page,
      isCurrent: page === currentPage
    }))
}
