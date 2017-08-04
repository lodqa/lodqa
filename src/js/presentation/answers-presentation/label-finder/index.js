const sparqlFetchLabel = require('sparql-fetch-label')
const LabelCache = require('./Label-cache')

const fetch = sparqlFetchLabel()
const cache = new LabelCache()

// The label finder fetch label information of the url from the sparql endpoint.
// And it caches label informations.
module.exports = class LabefFinder {
  // The solutions is a array of object.
  // Each object has id of nodes as key and url of nodes as value.
  // For example:
  // [
  //   {
  //     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1438",
  //     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  //     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
  //   },
  //   {
  //     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1884",
  //     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  //     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
  //   },
  //   {
  //     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1885",
  //     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  //     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
  //   },
  //   {
  //     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/239",
  //     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  //     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
  //   },
  //   {
  //     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/83",
  //     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  //     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
  //   }
  // ]
  find(solutions, callback) {
    const {
      endpointUrl,
      needProxy
    } = getEndPointInformationFromDom()

    const uniqUrls = getUniqUrls(solutions)

    for (const url of uniqUrls) {
      getLabelOfEachUrl(cache, endpointUrl, url, needProxy, callback)
    }
  }
}

function getEndPointInformationFromDom() {
  const endpointUrl = document.querySelector('#endpoint-url')
    .value
  const needProxy = document.querySelector('#need-proxy')
    .value === 'true'

  return {
    endpointUrl,
    needProxy
  }
}

// Create an array of non-duplicate URLs
function getUniqUrls(solutions){
  return Array.from(
    new Set(solutions.reduce(
      (array, solution) => {
        for (const url of Object.values(solution)){
          array.push(url)
        }
        return array
      }, [])
    )
  )
}

// Get labels of urls
function getLabelOfEachUrl(cache, endpointUrl, url, needProxy, callback){
  const cachedLabel = cache.get(endpointUrl, url)

  if(cachedLabel) {
    callback(url, cachedLabel)
  } else {
    fetchLabel(cache, endpointUrl, url, needProxy, callback)
  }
}

// Fetch label of url
function fetchLabel(cache, endpointUrl, url, needProxy, callback){
  fetch(endpointUrl, url, needProxy && '/proxy')
    .then((label) => {
      if (label) {
        cache.set(endpointUrl, url, label)
        callback(url, label)
      }
    })
}
