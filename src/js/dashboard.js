/* global graphEditor */
document.addEventListener('DOMContentLoaded', () => {

  // sample queries
  document.querySelector('#button-show-queries')
    .addEventListener('click', (e) => {
      e.stopPropagation()
      var element = document.querySelector('.examples')
      if (element.classList.contains('examples--hidden')) {
        element.classList.remove('examples--hidden')
      } else {
        element.classList.add('examples--hidden')        
      }
    })

  document.querySelector('.sample-queries')
    .addEventListener('click', (e) => {
      document.querySelector('#query')
        .value = e.target.text
      document.querySelector('.examples')
        .classList.add('examples--hidden')
    })

  const editor = graphEditor('/termfinder')

  // init graph
  editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp')
    .innerHTML))

  // add event listeners
  const selector = document.querySelector('#target')
  selector.addEventListener('change', (e) => changeTarget(e.target.value))

  // initial target
  changeTarget(selector.value)

  function applyConfig(config) {
    setTargetDisplay(config)

    setDictionaryUrl(editor, config)
    setNlqFormTarget(config)
    setEndpoint(config)
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
      .value = config.name
  }

  function setEndpoint(config) {
    document.querySelector('#endpoint-url')
      .value = config.endpoint_url
    document.querySelector('#need-proxy')
      .value = (config.name === 'biogateway')
  }

  function setDictionaryUrl(editor, config) {
    const dicUrl = config.dictionary_url
    const predDicUrl = config.pred_dictionary_url
    editor.setDictionaryUrl(dicUrl, predDicUrl)
  }

  function updateExampleQeries(editor, config) {
    const {
      sample_queries
    } = config
    const dom = document.querySelector('.sample-queries')

    if (sample_queries) {
      const listItems = sample_queries
        .map((q) => `<li><a href="#">${q}</a></li>`)
        .join('')

      dom.innerHTML = listItems
    } else {
      dom.innerHTML = ''
    }
  }

  function changeTarget(target) {
    const url = 'http://targets.lodqa.org/targets/' + target;

    var req;
    req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState === XMLHttpRequest.DONE) {
        if (this.status == 200) {
          const config = JSON.parse(this.response);
          applyConfig(config);
        } else {
          console.log("Gateway error!")
        }
      }
    };
    req.open('GET', url);
    req.setRequestHeader('Accept', 'application/json');
    req.send();
  }
})
