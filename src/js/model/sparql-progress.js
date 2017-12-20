const {
  EventEmitter
} = require('events')
const getUniqAnswers = require('./get-uniq-answers')

module.exports = class extends EventEmitter {
  constructor(dataset) {
    super()

    this._dataset = dataset

    // Listen dataset
    dataset.on('sparql_reset_event', () => this.emit('sparql_progress_change_event'))
    dataset.on('sparql_add_event', () => this.emit('sparql_progress_change_event'))
    dataset.on('solution_add_event', () => this.emit('sparql_progress_change_event'))
  }

  get snapshot() {
    return {
      value: this._dataset.sparqlCount,
      max: this._dataset.sparqlsMax,
      percentage: this._dataset.sparqlsMax === 0 ? 0 : Math.floor(this._dataset.sparqlCount / this._dataset.sparqlsMax * 1000) / 10,
      showDetail: this._showDetail
    }
  }

  get currentStatusOfSparqls() {
    if(!this._showDetail) {
      return {
        show: false
      }
    }

    // Return current status of SPARQLs
    const sparqls = Array.from(Array(this._dataset.sparqlsMax))
      .map((val, index) => {
        const sparqlNumber = `${index + 1}`
        const sparqlLink = {
          sparqlNumber
        }

        // SPARQLs with solutions
        if (this._dataset.hasSolution(sparqlNumber)) {
          const {
            solution
          } = this._dataset.getSolution(sparqlNumber)
          const uniqAnswersLength = getUniqAnswers(solution.solutions, this._dataset.focus)
            .length
          const error = solution.sparql_timeout

          return Object.assign(sparqlLink, {
            hasSolution: true,
            uniqAnswersLength,
            error: error && error.error_message
          })
        }

        // The next SPARQL is progress
        if (this._dataset.progress && sparqlNumber === `${this.sparqlCount + 1}`) {
          return Object.assign(sparqlLink, {
            hasSolution: false,
            isProgress: true
          })
        }

        return Object.assign(sparqlLink, {
          hasSolution: false,
        })
      })

    return {
      show: true,
      sparqls
    }
  }

  set showDetail(isShow) {
    this._showDetail = isShow
    this.emit('sparql_progress_show_detail_event')
  }
}
