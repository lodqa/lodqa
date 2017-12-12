const {
  EventEmitter
} = require('events')
const DatasetProgress = require('./dataset-progress')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._visible = false
    this._datasets = new Map()

    // A Dataset with bgps will have SPARQLs
    loader.on('bgps', ({
      dataset,
      bgps
    }) => {
      if (!this._datasets.has(dataset)) {
        this._datasets.set(dataset, new DatasetProgress(dataset))
      }

      this._datasets.get(dataset)
        .addBgps(bgps)
      this.emit('progress_datasets_update_event')
    })

    loader.on('solutions', ({
      dataset,
      anchored_pgp,
      bgp,
      solutions,
      error
    }) => {
      this._datasets.get(dataset)
        .addSolutions(error, anchored_pgp, bgp, solutions)
      this.emit('progress_datasets_update_event')
    })
  }

  set visible(visible) {
    this._visible = visible
    this.emit('progress_datasets_update_event')
  }

  showDataset(dataset, isShow) {
    // Show or hide the specific dataset
    if (isShow) {
      this._selectdDataset = dataset
    } else {
      this._selectdDataset = null
    }

    this.emit('progress_datasets_update_event')
  }

  get stateOfSparqlsOfSelectedDataset() {
    if (!this._visible) {
      return
    }

    return this._selectdDataset && {
      name: this._selectdDataset,
      sparqls: this._datasets.get(this._selectdDataset).snapshot
    }
  }

  get snapshot() {
    if (!this._visible) {
      return []
    }

    return Array.from(this._datasets.values())
      .map((progress) => ({
        name: progress.name,
        max: progress.max,
        value: progress.value,
        percentage: progress.percentage,
        show: progress.name === this._selectdDataset
      }))
  }
}
