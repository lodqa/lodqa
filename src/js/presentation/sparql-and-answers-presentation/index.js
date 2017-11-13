const sparqlPresentationShow = require('../sparql-presentation/show')
const answersPresentationShow = require('../answers-presentation/show-solution')
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

      sparqlPresentationShow(content, sparqlCount, sparql, solution.sparql_timeout)
      answersPresentationShow(content, anchoredPgp, solution)
    } else {
      sparqlPresentationShow(content, sparqlCount, sparql)
    }
  }
}

function closeDialog(lightboxDomId) {
  document.querySelector(`#${lightboxDomId}`)
    .classList.add('hidden')
}
