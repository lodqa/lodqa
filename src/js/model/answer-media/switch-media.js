module.exports = function(rendering) {
  if (rendering.mime_type.startsWith('image/')) {
    return Object.assign({
      image: true
    }, rendering)
  }

  if (rendering.mime_type.startsWith('audio/')) {
    return Object.assign({
      audio: true
    }, rendering)
  }

  return null
}
