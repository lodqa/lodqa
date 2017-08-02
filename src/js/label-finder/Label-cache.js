// Cache of url's label.
// Labels are stored for each endpoint.
module.exports = function LabelCache() {
  const map = new Map()

  return {
    get: (endpointUrl, url) => get(map, endpointUrl, url),
    set: (endpointUrl, url, label) => set(map, endpointUrl, url, label)
  }
}

function get(map, endpointUrl, url) {
  if (map.has(endpointUrl)) {
    return map.get(endpointUrl)
      .get(url)
  }
}

function set(map, endpointUrl, url, label) {
  const labelMap = getOrCreateLabelMap(map, endpointUrl)

  labelMap.set(url, label)
}

function getOrCreateLabelMap(map, endpointUrl) {
  if (map.has(endpointUrl)) {
    return map.get(endpointUrl)
  } else {
    const newMap = new Map()

    map.set(endpointUrl, newMap)
    return newMap
  }
}
