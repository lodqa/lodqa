const sparqlPresentation = require('../sparql-presentation')
const answersPresentation = require('../answers-presentation')
const bindClickOnLightBoxToCloseIt = require('./bind-click-on-lightbox-to-close-it')

module.exports = class {
  constructor(lightboxDomId) {
    this.lightboxDomId = lightboxDomId
    bindClickOnLightBoxToCloseIt(lightboxDomId)
  }

  show(sparqlCount, anchoredPgp, solution) {
    if (solution && solution.solutions.length) {
      const lightbox = document.querySelector(`#${this.lightboxDomId}`)
      lightbox.classList.remove('hidden')

      const content = lightbox.querySelector('.content')
      content.innerHTML = ''
      sparqlPresentation.show(content, solution, sparqlCount)
      answersPresentation.setAnchoredPgp(anchoredPgp)
      answersPresentation.showSolution(content, solution)
    }
  }
}
