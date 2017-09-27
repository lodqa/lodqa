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

module.exports =  function(target) {
  getTargetConfig(target)
    .then((json) => {
      const url = new URL(location.href)
      const sampleQueries = json.sample_queries.map((query) => {
        url.searchParams.set('query', query)

        return {
          query,
          href: url.toString()
        }
      })

      document
        .querySelector('.description')
        .innerHTML = template(sampleQueries)
    })
}
