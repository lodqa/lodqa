const getTargetConfig = require('../get-target-config')
const handlebars = require('handlebars')

const template = handlebars.compile(`
  <div class="description__sample-queries">
    <ul class="description__sample-queries__query-list">
    {{#each this}}
      <li><a href="{{href}}">{{query}}</a></li>
    {{/each}}
    </ul>
  </div>
`)
const cache = {}

module.exports = {
  updateTarget(dom, target) {
    getTargetConfig(target)
      .then((json) => {
        cache.config = json
        update(dom,  cache.config, cache.readTimeout)
      })
  },
  updateReadTimeout(dom, readTimeout) {
    cache.readTimeout = readTimeout
    update(dom, cache.config, cache.readTimeout)
  }
}

function update(dom, config, readTimeout) {
  const url = new URL(location.href)
  const sampleQueries = config.sample_queries.map((query) => {
    url.searchParams.set('query', query)
    if (readTimeout) {
      url.searchParams.set('read_timeout', readTimeout)
    }

    return {
      query,
      href: url.toString()
    }
  })

  dom.innerHTML = template(sampleQueries)
}
