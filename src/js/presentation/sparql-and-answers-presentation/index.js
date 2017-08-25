const sparqlPresentation = require('../sparql-presentation')
const answersPresentation = require('../answers-presentation')
const bindClickOnSideOfLightBoxToCloseIt = require('./bind-click-on-side-of-lightbox-to-close-it')
const bindOneKeyupHandler = require('../../answer/bind-one-keyup-handler')
const doIfEsc = require('../../answer/do-if-esc')

module.exports = class {
  constructor(lightboxDomId, onClose) {
    this.lightboxDomId = lightboxDomId

    this.close = () => {
      closeDialog(this.lightboxDomId)
      onClose()
    }

    bindClickOnSideOfLightBoxToCloseIt(lightboxDomId, this.close)
  }

  show(sparqlCount, sparql, data) {
    const lightbox = document.querySelector(`#${this.lightboxDomId}`)
    lightbox.classList.remove('hidden')

    bindOneKeyupHandler(doIfEsc(this.close))

    const content = lightbox.querySelector('.content')
    content.innerHTML = ''

    if (data) {
      const {
        anchoredPgp,
        solution
      } = data

      sparqlPresentation.show(content, sparqlCount, sparql, solution.sparql_timeout)
      answersPresentation.setAnchoredPgp(anchoredPgp)
      answersPresentation.showSolution(content, solution)
    } else {
      sparqlPresentation.show(content, sparqlCount, sparql)
    }
  }
}

function closeDialog(lightboxDomId) {
  document.querySelector(`#${lightboxDomId}`)
    .classList.add('hidden')
}
