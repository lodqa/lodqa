const sparqlPresentationShow = require('../sparql-presentation/show')
const answersPresentationShow = require('../answers-presentation/show-solution')
const bindClickOnSideOfLightBoxToCloseIt = require('./bind-click-on-side-of-lightbox-to-close-it')
const bindOneKeyupHandler = require('./bind-one-keyup-handler')
const doIfEsc = require('./do-if-esc')

module.exports = class {
  constructor(lightboxDomId, onClose) {
    this.lightboxDomId = lightboxDomId

    this.close = () => {
      closeDialog(this.lightboxDomId)
      onClose()
    }

    bindClickOnSideOfLightBoxToCloseIt(lightboxDomId, this.close)
  }

  show(sparqlNumber, datasetName, anchoredPgp, sparql, solution, answers, error) {
    console.assert(sparqlNumber, 'sparqlNumber is not set')
    console.assert(datasetName, 'datasetName is not set')
    console.assert(anchoredPgp, 'anchoredPgp is not set')
    console.assert(sparql, 'sparql is not set')
    console.assert(solution, 'solution is not set')

    const lightbox = document.querySelector(`#${this.lightboxDomId}`)
    lightbox.classList.remove('hidden')

    bindOneKeyupHandler(doIfEsc(this.close))

    const dom = lightbox.querySelector('.content')
    dom.innerHTML = datasetName

    if (solution && solution.solutions.length) {
      sparqlPresentationShow(dom, sparqlNumber, sparql)
      const [list, table, graph] = answersPresentationShow(dom, anchoredPgp, solution)

      for (const {
        url,
        label
      } of answers) {
        list.updateLabel(url, label)
        table.updateLabel(url, label)
        graph.updateLabel(url, label)
      }
    } else {
      sparqlPresentationShow(dom, sparqlNumber, sparql, error)
    }
  }
}

function closeDialog(lightboxDomId) {
  document.querySelector(`#${lightboxDomId}`)
    .classList.add('hidden')
}
