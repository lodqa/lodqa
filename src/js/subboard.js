/* global graphEditor*/
const targets = JSON.parse(document.querySelector('#targets').innerHTML),
  targeth = targets.reduce(function(a, b) {
    a[b.name] = b
    return a
  }, {}),
  editor = graphEditor('/termfinder')

editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp').innerHTML))

const selector = document.querySelector('#target'),
  target = selector.options[selector.selectedIndex].value
changeTarget(editor, targeth[target])

selector.addEventListener('change', () => changeTarget(editor, targeth[selector.value]))

function changeTarget(editor, config) {
  const dicUrl = config.dictionary_url
  editor.setDictionaryUrl(dicUrl)

  // to setup sample queries
  const sample_queries = config.sample_queries,
    sampleQueries = document.querySelector('#sample_queries')

  if (sample_queries) {
    sampleQueries.innerHTML = `<fieldset style="display:inline-block"><legend>Sample queries</legend><ul><li><a>${sample_queries.join('</a></li><li><a>')}</a></li></ul></fieldset>`
    setQueriesCopiable()
  } else {
    sampleQueries.innerHTML = ''
  }

  // to setup target in NLQ form
  document.querySelector('#nlqform input[name="target"]').value = config['name']
  if (config['home']) {
    document.querySelector('#target-display').innerHTML = `@<a href="${config['home']}">${config['name']}</a>`
  } else {
    document.querySelector('#target-display').innerHTML = `@${config['name']}`
  }
}

function setQueriesCopiable() {
  const links = document.querySelectorAll('#sample_queries a')
  for (let i = 0; i < links.length; i++) {
    links[i].addEventListener('click', (e) => document.querySelector('#query').value = e.target.text)
  }
}
