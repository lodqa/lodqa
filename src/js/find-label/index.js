const LabelCache = require('./Label-cache')
const getLabelOfEachUrl = require('./get-label-of-each-url')

const cache = new LabelCache()

// The label finder fetch label information of the url from the sparql endpoint.
// And it caches label informations.
//
// The urls is a array of string.
// For example:
// [
//   "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1438",
//   "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
//   "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
//   "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1884",
//   "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1885",
//   "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/239",
//   "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/83",
// ]
//
// The onFetch is a callback funciton.
// It will be called whenever the label of a url will be get.
// it is called with url and label as arguments.
module.exports = function(urls, onFetch, {
  endpointUrl,
  needProxy
}) {
  for (const url of urls) {
    getLabelOfEachUrl(cache, endpointUrl, url, needProxy, onFetch)
  }
}
