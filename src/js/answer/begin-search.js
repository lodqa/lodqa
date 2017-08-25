module.exports = function(loader, pgpDomId, mappnigsDomId, targetDomId) {
  const pgp = JSON.parse(document.querySelector(`#${pgpDomId}`)
    .innerHTML)
  const mappings = JSON.parse(document.querySelector(`#${mappnigsDomId}`)
    .innerHTML)
  const config = document.querySelector(`#${targetDomId}`)
    .value

  loader.beginSearch(pgp, mappings, '/solutions', config)
}
