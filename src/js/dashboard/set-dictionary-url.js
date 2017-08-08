module.exports = function(editor, config) {
  const dicUrl = config.dictionary_url
  const predDicUrl = config.pred_dictionary_url
  editor.setDictionaryUrl(dicUrl, predDicUrl)
}
