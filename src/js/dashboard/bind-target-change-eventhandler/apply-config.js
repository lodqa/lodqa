const handlebars = require('handlebars')
const template = handlebars.compile(`
  {{#each sample_queries}}
    <li><a href="#">{{this}}</a></li>
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
    sample_queries
  } = config
  const dom = document.querySelector('.sample-queries')

  if (sample_queries) {
    dom.innerHTML = template({sample_queries})
  } else {
    dom.innerHTML = ''
  }
}
