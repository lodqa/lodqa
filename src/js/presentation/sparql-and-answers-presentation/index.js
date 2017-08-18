const sparqlPresentation = require('../sparql-presentation')
const answersPresentation = require('../answers-presentation')
const bindClickOnLightBoxToCloseIt = require('./bind-click-on-lightbox-to-close-it')

module.exports = class {
  constructor(lightboxDomId) {
    this.lightboxDomId = lightboxDomId
    bindClickOnLightBoxToCloseIt(lightboxDomId)
  }

  show(sparqlCount, sparql, data) {
    const lightbox = document.querySelector(`#${this.lightboxDomId}`)
    lightbox.classList.remove('hidden')

    const content = lightbox.querySelector('.content')
    content.innerHTML = ''

    if (data) {
      const {
        anchoredPgp,
        solution
      } = data

      sparqlPresentation.show(content, sparqlCount, sparql, solution.solutions, solution.sparql_timeout, true)
      answersPresentation.setAnchoredPgp(anchoredPgp)
      answersPresentation.showSolution(content, solution)
    } else {
      sparqlPresentation.show(content, sparqlCount, sparql, [], false, true)
    }
  }
}
