module.exports = function(loader) {
  const pathname = '/one_by_one_execute'
  const url = new URLSearchParams(window.location.search)
  loader.begin(pathname, new Map([
    ['query', url.get('query') || ''],
    ['search_id', url.get('search_id') || ''],
    ['target', url.get('target') || ''],
    ['read_timeout', url.get('read_timeout') || '']
  ]))
}
