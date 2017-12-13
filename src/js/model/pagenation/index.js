const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(answerSummary) {
    super()

    this._itemsPerPage = 7
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
    if (this._maxPageNumber > 1) {
      return {
        enablePrev: this._currentPage !== 1,
        enableNext: this._currentPage !== this._maxPageNumber,
        disablePrev: this._currentPage === 1,
        disableNext: this._currentPage === this._maxPageNumber,
        pages: Array
          .from(Array(this._maxPageNumber)
            .keys())
          .map((page) => ({
            page: page + 1,
            isCurrent: page + 1 === this._currentPage
          })),
      }
    }
  }

  get snapshot() {
    return this._currentPageContent
  }

  get _currentPageContent() {
    return this._answerSummary.snapshot.slice((this._currentPage - 1) * this._itemsPerPage, this._currentPage * this._itemsPerPage)
  }
}
