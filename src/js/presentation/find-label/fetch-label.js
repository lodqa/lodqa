const sparqlFetchLabel = require('sparql-fetch-label')
const fetch = sparqlFetchLabel()

// Fetch label of url
module.exports = function(cache, endpointUrl, url, needProxy, callback) {
  fetch(endpointUrl, url, needProxy && '/proxy')
    .then((label) => {
      if (label) {
        cache.set(endpointUrl, url, label)
        callback(url, label)
      } else {
        cache.setNonResolvableUrl(endpointUrl, url)
      }
    })
    .catch((error) => console.error(error))
}
