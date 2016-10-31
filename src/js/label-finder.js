const sparqlFetchLabel = require('sparql-fetch-label')
const fetch = sparqlFetchLabel()

module.exports = class LabefFinder {
  constructor(graph) {
    this.graph = graph
  }

  onAnchoredPgp(domId, anchoredPgp) {
    const {
      endpointUrl,
      needProxy
    } = getEndPoint()

    for (const node of Object.values(anchoredPgp.nodes)) {
      fetch(endpointUrl, node.term, needProxy && '/proxy')
        .then((label) => node.label = label)
    }
  }

  onSolution(data) {
    const {
      endpointUrl,
      needProxy
    } = getEndPoint()

    for (const solution of data.solutions) {
      for (const url of Object.values(solution)) {
        fetch(endpointUrl, url, needProxy && '/proxy')
          .then((label) => {
            if (label) {
              this.graph.updateLabel(url, label)
            }
          })
      }
    }
  }
}

function getEndPoint() {
  const endpointUrl = document.querySelector('#endpoint-url')
    .value
  const needProxy = document.querySelector('#need-proxy')
    .value === 'true'

  return {
    endpointUrl,
    needProxy
  }
}
