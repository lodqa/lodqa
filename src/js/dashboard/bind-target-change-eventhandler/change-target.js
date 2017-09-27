const getTargetConfig = require('../../get-target-config')
const applyConfig = require('./apply-config')
const setDictionaryUrl = require('./set-dictionary-url')

module.exports = function(target, editor = null) {
  getTargetConfig(target)
    .then((config) => {
      applyConfig(config)
      if (editor) {
        setDictionaryUrl(editor, config)
      }
    })
    .catch(() => console.log('Gateway error!'))
}
