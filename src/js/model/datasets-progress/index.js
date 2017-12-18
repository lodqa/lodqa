const {
  EventEmitter
} = require('events')
const DatasetProgress = require('./dataset-progress')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._visible = false
    this._datasets = new Map()

    // The number of bpgs is same the number of SPARQLs.
    loader.on('bgp', ({
      dataset,
      bgp
    }) => {
      if (!this._datasets.has(dataset)) {
        this._datasets.set(dataset, new DatasetProgress(dataset))
      }

      this._datasets.get(dataset)
        .addBgp(bgp)
      this.emit('progress_datasets_update_event')

      if (dataset === this._selectdDataset) {
        this.emit('progress_selected_dataset_update_event')
      }
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

      if (dataset === this._selectdDataset) {
        this.emit('progress_selected_dataset_update_event')
      }
    })
  }

  set visible(visible) {
    this._visible = visible
    this.emit('progress_datasets_update_event')
    this.emit('progress_selected_dataset_update_event')
  }

  showDataset(dataset, isShow) {
    // Show or hide the specific dataset
    if (isShow) {
      this._selectdDataset = dataset
    } else {
      this._selectdDataset = null
    }

    this.emit('progress_datasets_update_event')
    this.emit('progress_selected_dataset_update_event')
  }

  hideSparql(dataset, sparqlNumber, show) {
    this._datasets.get(dataset)
      .hideSparql(sparqlNumber, show)
  }

  get stateOfSparqlsOfSelectedDataset() {
    if (this._visible && this._selectdDataset) {
      return {
        name: this._selectdDataset,
        sparqls: this._datasets.get(this._selectdDataset)
          .snapshot
      }
    }

    return {
      sparqls: []
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
