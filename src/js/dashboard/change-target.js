const applyConfig = require('./apply-config')
const setDictionaryUrl = require('./set-dictionary-url')

module.exports = function(target, editor = null) {
  const url = `http://targets.lodqa.org/targets/${target}`
  const req = new XMLHttpRequest()

  req.onreadystatechange = function() {
    if (this.readyState === XMLHttpRequest.DONE) {
      if (this.status == 200) {
        const config = JSON.parse(this.response)
        applyConfig(config)
        if (editor) {
          setDictionaryUrl(editor, config)
        }
      } else {
        console.log('Gateway error!')
      }
    }
  }
  req.open('GET', url)
  req.setRequestHeader('Accept', 'application/json')
  req.send()
}
