module.exports = function(rendering) {
  const media = {}
  media[rendering.mime_type.split('/')[0]] = true
  return Object.assign(media, rendering)
}
