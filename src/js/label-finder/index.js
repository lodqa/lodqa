const sparqlFetchLabel = require('sparql-fetch-label')
const LabelCache = require('./Label-cache')

const fetch = sparqlFetchLabel()
const cache = new LabelCache()

module.exports = class LabefFinder {
  constructor(callback) {
    this.callback = callback
  }

  onSolution(data) {
    const {
      endpointUrl,
      needProxy
    } = getEndPoint()

    // Create an array of non-duplicate URLs
    const uniqUrls = Array.from(
      new Set(data.solutions.reduce(
        (array, solution) => {
          for (const url of Object.values(solution)){
            array.push(url)
          }
          return array
        }, [])
      )
    )


    // Get labels of urls
    for (const url of uniqUrls) {
      const cachedLabel = cache.get(endpointUrl, url)

      if(cachedLabel) {
        this.callback(url, cachedLabel)
      } else {
        fetch(endpointUrl, url, needProxy && '/proxy')
          .then((label) => {
            if (label) {
              cache.set(endpointUrl, url, label)
              this.callback(url, label)
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
