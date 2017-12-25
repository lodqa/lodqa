const handlebars = require('handlebars')

const template = handlebars.compile(`
  {{#each this}}
    <li><a href="{{href}}">{{query}}</a></li>
  {{/each}}
`)
const cache = {}

module.exports = {
  updateConfig(config) {
    cache.config = config
    update(cache.config, cache.readTimeout)
  },
  updateReadTimeout(readTimeout){
    cache.readTimeout = readTimeout
    update(cache.config, cache.readTimeout)
  }
}

function update(config, readTimeout) {
  const {
    name,
    sample_queries
  } = config
  const dom = document.querySelector('.sample-queries')

  if (sample_queries) {
    const url = new URL(location.href)
    const data = sample_queries.map((query) => {
      url.searchParams.set('target', name)
      url.searchParams.set('query', query)

      if(readTimeout) {
        url.searchParams.set('read_timeout', readTimeout)
      }

      return {
        query,
        href: url.toString()
      }
    })

    dom.innerHTML = template(data)
  } else {
    dom.innerHTML = ''
  }
}
