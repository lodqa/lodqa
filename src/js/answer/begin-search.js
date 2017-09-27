module.exports = function(loader, pgpDomId, mappnigsDomId, targetDomId, readTimeoutDomId) {
  const pgp = JSON.parse(document.querySelector(`#${pgpDomId}`)
    .innerHTML)
  const mappings = JSON.parse(document.querySelector(`#${mappnigsDomId}`)
    .innerHTML)
  const target = document.querySelector(`#${targetDomId}`)
    .innerHTML
  const readTimeout = document.querySelector(`#${readTimeoutDomId}`)
    .value

  loader.beginSearch(pgp, mappings, '/solutions', target, readTimeout)
}
