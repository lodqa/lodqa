/* global graphEditor*/
document.addEventListener('DOMContentLoaded', () => {
  const targets = JSON.parse(document.querySelector('#targets')
    .innerHTML)
  const targeth = targets.reduce(function(a, b) {
    a[b.name] = b
    return a
  }, {})
  const editor = graphEditor('/termfinder')

  // init graph
  editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp')
    .innerHTML))

  // add event listeners
  const selector = document.querySelector('#target')
  selector.addEventListener('change', (e) => applayTarget(e.target, targeth, editor))

  document.querySelector('.dashboard__exapmle-button')
  .addEventListener('click', () => document.querySelector('.examples').classList.remove('examples--hidden'))

  document.querySelector('.sample-queries')
    .addEventListener('click', (e) => {
      document.querySelector('#query').value = e.target.text
      document.querySelector('.examples').classList.add('examples--hidden')
    })

  // initial target
  applayTarget(selector, targeth, editor)

  function applayTarget(selector, targeth, editor){
    const config = targeth[selector.value]

    setTargetDisplay(config)
    setDictionaryUrl(editor, config)
    setNlqFormTarget(config)
    updateExampleQeries(editor, config)
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
      .value = config['name']
  }

  function setDictionaryUrl(editor, config) {
    const dicUrl = config.dictionary_url
    editor.setDictionaryUrl(dicUrl)
  }

  function updateExampleQeries(editor, config) {
    const {sample_queries} = config
    const dom = document.querySelector('.sample-queries')

    if(sample_queries){
      const listItems = sample_queries
        .map((q) => `<li><a href="#">${q}</a></li>`)
        .join('')

      dom.innerHTML = listItems
    } else {
      dom.innerHTML = ''
    }
  }
})
