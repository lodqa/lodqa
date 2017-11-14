const showSolution = require('./show-solution')

module.exports = class {
  constructor(dom, model) {
    this._components = []

    model.on('solution_add_event', () => this._components = this._components.concat(
      showSolution(
        dom,
        model.anchoredPgp,
        model.currentSolution
      )
    ))

    model.on('label_update_event', () => {
      model.labelAndUrls.forEach(({
        label,
        url
      }) => {
        this._components
          .forEach(c => {
            // Elements of _components may be undefined when the SPARQL has no answers.
            if (c && c.updateLabel) {
              c.updateLabel(url, label)
            }
          })
      })
    })
  }
}
