const fetchLabel = require('./fetch-label')

// Get labels of urls
module.exports = function(cache, endpointUrl, url, needProxy, callback) {
  if (cache.isNonResolvableUrl(endpointUrl, url)) {
    return
  }

  const cachedLabel = cache.get(endpointUrl, url)

  if (cachedLabel) {
    callback(url, cachedLabel)
  } else {
    fetchLabel(cache, endpointUrl, url, needProxy, callback)
  }
}
