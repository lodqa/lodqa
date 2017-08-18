const sparqlPresentation = require('../sparql-presentation')
const answersPresentation = require('../answers-presentation')
const bindClickOnLightBoxToCloseIt = require('./bind-click-on-lightbox-to-close-it')
const bindOneKeyupHandler = require('../../execute/bind-one-keyup-handler')
const doIfEsc = require('../../execute/do-if-esc')

module.exports = class {
  constructor(lightboxDomId, onClose) {
    this.lightboxDomId = lightboxDomId

    this.close = () => {
      closeDialog(this.lightboxDomId)
      onClose()
    }

    bindClickOnLightBoxToCloseIt(lightboxDomId, this.close)
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
