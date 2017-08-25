module.exports = function() {
  const endpointUrl = document.querySelector('#endpoint-url')
    .value
  const needProxy = document.querySelector('#need-proxy')
    .value

  console.assert(endpointUrl, 'endpointUrl is not set!')
  console.assert(needProxy, 'needProxy is not set!')

  if (!endpointUrl && !needProxy) {
    throw new Error('Parameters for finding label is lacked.')
  }

  return {
    endpointUrl,
    needProxy: needProxy === 'true'
  }
}
