module.exports = function(loader, pgpDomId, parent, mappnigsDomSelector, target, readTimeoutDomId) {
  const pgp = JSON.parse(document.querySelector(`#${pgpDomId}`)
    .innerHTML)
  const mappings = JSON.parse(parent.querySelector(`${mappnigsDomSelector}`)
    .innerHTML)
  const readTimeout = document.querySelector(`#${readTimeoutDomId}`)
    .value

  loader.beginSearch(pgp, mappings, '/solutions', target, readTimeout)
}
