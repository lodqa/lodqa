// Cache of url's label.
// Labels are stored for each endpoint.
module.exports = function LabelCache() {
  const storedUrl = new Map()
  const nonResolvableUrl = new Map()

  return {
    get: (endpointUrl, url) => get(storedUrl, endpointUrl, url),
    set: (endpointUrl, url, label) => set(storedUrl, endpointUrl, url, label),
    setNonResolvableUrl: (endpointUrl, url) => setNonResolvableUrl(nonResolvableUrl, endpointUrl, url),
    isNonResolvableUrl: (endpointUrl, url) => isNonResolvableUrl(nonResolvableUrl, endpointUrl, url)
  }
}

function get(storedUrl, endpointUrl, url) {
  if (storedUrl.has(endpointUrl)) {
    return storedUrl.get(endpointUrl)
      .get(url)
  }
}

function set(storedUrl, endpointUrl, url, label) {
  const labelMap = getOrCreateLabelMap(storedUrl, endpointUrl)

  labelMap.set(url, label)
}

function setNonResolvableUrl(nonResolvableUrl, endpointUrl, url) {
  const set = getOrCreateUrlSet(nonResolvableUrl, endpointUrl)

  set.add(url)
}

function isNonResolvableUrl(nonResolvableUrl, endpointUrl, url) {
  if (nonResolvableUrl.get(endpointUrl)) {
    return nonResolvableUrl.get(endpointUrl)
      .has(url)
  }
}

function getOrCreateLabelMap(storedUrl, endpointUrl) {
  return getOrCreateStoreForEndpoint(storedUrl, endpointUrl, () => new Map())
}

function getOrCreateUrlSet(storedUrl, endpointUrl) {
  return getOrCreateStoreForEndpoint(storedUrl, endpointUrl, () => new Set())
}

function getOrCreateStoreForEndpoint(parentStroe, endpointUrl, constructor) {
  if (!parentStroe.has(endpointUrl)) {
    parentStroe.set(endpointUrl, constructor())
  }

  return parentStroe.get(endpointUrl)
}
