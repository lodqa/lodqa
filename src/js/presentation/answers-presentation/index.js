const showSolution = require('./show-solution')

module.exports = class {
  constructor(dom, dataset) {
    this._components = []

    dataset.on('solution_add_event', () => this._components = this._components.concat(
      showSolution(
        dom,
        dataset.anchoredPgp,
        dataset.currentSolution
      )
    ))

    dataset.on('label_update_event', () => {
      for (const {
        label,
        url
      } of dataset.labelAndUrls) {
        this._components
          .forEach(c => {
            // Elements of _components may be undefined when the SPARQL has no answers.
            if (c && c.updateLabel) {
              c.updateLabel(url, label)
            }
          })
      }
    })
  }
}
