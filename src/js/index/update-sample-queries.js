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
  updateTarget(target) {
    getTargetConfig(target)
      .then((json) => {
        cache.config = json
        update(cache.config, cache.readTimeout)
      })
  },
  updateReadTimeout(readTimeout) {
    cache.readTimeout = readTimeout
    update(cache.config, cache.readTimeout)
  }
}

function update(config, readTimeout) {
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

  document
    .querySelector('.description')
    .innerHTML = template(sampleQueries)
}
