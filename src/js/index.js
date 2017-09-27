const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')

const handlebars = require('handlebars')
const template = handlebars.compile(`
  <div class="description__sample-queries">
    <ul class="description__sample-queries__query-list">
    {{#each sample_queries}}
      <li><a href="{{href}}">{{query}}</a></li>
    {{/each}}
    </ul>
  </div>
`)

bindModeButtonEventhandler('grapheditor')

const target = new URL(location.href)
  .searchParams.get('target')

if (target) {
  // Update a parameter of the read_timeout.
  document.querySelector('.description')
    .addEventListener('click', (e) => {

      if(e.target.localName === 'a') {
        // e.preventDefault()
        const url = new URL(e.target.href)
        url.searchParams.set('read_timeout', document.querySelector('#read_timeout').value)
        e.target.href = url.toString()
      }
    })

  getTargetConfig(target)
    .then((json) => {
      const url = new URL(location.href)
      const sample_queries = json.sample_queries.map((query) => {
        url.searchParams.set('query', query)

        return {
          query,
          href: url.toString()
        }
      })

      document
        .querySelector('.description')
        .innerHTML = template({
          sample_queries
        })
    })
}

function getTargetConfig(target) {
  const myHeaders = new Headers()
  myHeaders.set('Accept', 'application/json')

  return fetch(`http://targets.lodqa.org/targets/${target}`, {
    method: 'GET',
    headers: myHeaders
  })
    .then((response) => {
      return response.json()
    })
}
