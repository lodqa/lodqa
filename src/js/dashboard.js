/* global graphEditor*/ ! function() {
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

  document.querySelector('#sample_queries2')
    .addEventListener('change', (e) => document.querySelector('#query')
      .value = e.target.value)

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
    const sample_queries = config.sample_queries
    const sampleQueries2 = document.querySelector('#sample_queries2')

    if (sample_queries) {
      const options = sample_queries
        .map((q) => `<option>${q}</option>`)
        .join()
      sampleQueries2.innerHTML = options
      sampleQueries2.value = document.querySelector('#query')
        .value
    } else {
      sampleQueries2.innerHTML = ''
    }
  }
}()
