module.exports = function(loader) {
  const pathname = '/one_by_one_execute'
  const url = new URLSearchParams(window.location.search)
  loader.begin(pathname, new Map([
    ['query', url.get('query') || ''],
    ['query_id', url.get('query_id') || ''],
    ['target', url.get('target') || ''],
    ['read_timeout', url.get('read_timeout') || '']
  ]))
}
