const {
  EventEmitter
} = require('events')

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
        this._datasets.set(dataset, {
          max: 0,
          value: 0
        })
      }

      const state = this._datasets.get(dataset)
      state.max += bgps.length
      this.emit('progress_datasets_update_event')
    })
    loader.on('solutions', ({
      dataset
    }) => {
      const state = this._datasets.get(dataset)
      state.value += 1
      this.emit('progress_datasets_update_event')
    })
  }

  set visible(visible) {
    this._visible = visible
    this.emit('progress_datasets_update_event')
  }

  showDataset(dataset, isShow) {
    for (const [name, state] of this._datasets.entries()) {
      state.show = name === dataset
    }
    this.emit('progress_datasets_update_event')
    console.log('show', dataset, isShow)
  }

  get snapshot() {
    if (!this._visible) {
      return []
    }

    return Array.from(this._datasets.entries())
      .map(([name, state]) => ({
        name,
        max: state.max,
        value: state.value,
        percentage: Math.floor(state.value / state.max * 1000) / 10,
        show: state.show
      }))
  }
}
