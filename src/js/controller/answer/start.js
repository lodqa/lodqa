module.exports = function(loader) {
  const url = new URLSearchParams(window.location.search)

  if (url.get('search_id')) {
    loader.begin('/show_progress', new Map([
      ['search_id', url.get('search_id')]
    ]))
  } else if (url.get('query')) {
    loader.begin('/register_query', new Map([
      ['query', url.get('query')],
      ['target', url.get('target') || ''],
      ['read_timeout', url.get('read_timeout') || '']
    ]))
  } else {
    console.error('You need a search_id or query in query parameters.')
  }
}
