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

  show(dataset, sparqlNumber) {
    const sparql = dataset.getSparql(sparqlNumber)
    const data = dataset.getSolution(sparqlNumber)
    const lightbox = document.querySelector(`#${this.lightboxDomId}`)
    lightbox.classList.remove('hidden')

    bindOneKeyupHandler(doIfEsc(this.close))

    const content = lightbox.querySelector('.content')
    content.innerHTML = dataset.name

    if (data) {
      const {
        anchoredPgp,
        solution
      } = data

      sparqlPresentationShow(content, sparqlNumber, sparql, solution.sparql_timeout)
      answersPresentationShow(content, anchoredPgp, solution)
    } else {
      sparqlPresentationShow(content, sparqlNumber, sparql)
    }
  }

  show2(sparqlNumber, datasetName, anchoredPgp, sparql, solution, answers, error) {
    const lightbox = document.querySelector(`#${this.lightboxDomId}`)
    lightbox.classList.remove('hidden')

    bindOneKeyupHandler(doIfEsc(this.close))

    const dom = lightbox.querySelector('.content')
    dom.innerHTML = datasetName

    if (solution && solution.solutions.length) {
      sparqlPresentationShow(dom, sparqlNumber, sparql)
      const [list, table, graph] = answersPresentationShow(dom, anchoredPgp, solution)

      for (const {url, label} of answers) {
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
