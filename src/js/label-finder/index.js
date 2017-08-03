const sparqlFetchLabel = require('sparql-fetch-label')
const LabelCache = require('./Label-cache')

const fetch = sparqlFetchLabel()
const cache = new LabelCache()

module.exports = class LabefFinder {
  constructor(graph) {
    this.graph = graph
  }

  onSolution(data) {
    const {
      endpointUrl,
      needProxy
    } = getEndPoint()

    for (const solution of data.solutions) {
      for (const url of Object.values(solution)) {
        const cachedLabel = cache.get(endpointUrl, url)

        if(cachedLabel) {
          this.graph.updateLabel(url, cachedLabel)
        } else {
          fetch(endpointUrl, url, needProxy && '/proxy')
            .then((label) => {
              if (label) {
                cache.set(endpointUrl, url, label)
                this.graph.updateLabel(url, label)
              }
            })
        }
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
