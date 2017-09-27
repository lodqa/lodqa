const handlebars = require('handlebars')
const template = handlebars.compile(`
  {{#each this}}
    <li><a href="{{href}}">{{query}}</a></li>
  {{/each}}
`)

module.exports = function(config) {
  setTargetDisplay(config)
  setNlqFormTarget(config)
  setEndpoint(config)
  updateExampleQeries(config)
}

function setTargetDisplay(config) {
  if (config['home']) {
    document.querySelector('#target-display')
      .innerHTML = `@<a href="${config['home']}">${config['name']}</a>`
  } else {
    document.querySelector('#target-display')
      .innerHTML = `@${config['name']}`
  }
}

function setNlqFormTarget(config) {
  // to setup target in NLQ form
  document.querySelector('#nlqform input[name="target"]')
    .value = config.name
}

function setEndpoint(config) {
  document.querySelector('#endpoint-url')
    .value = config.endpoint_url
  document.querySelector('#need-proxy')
    .value = (config.name === 'biogateway')
}

function updateExampleQeries(config) {
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
