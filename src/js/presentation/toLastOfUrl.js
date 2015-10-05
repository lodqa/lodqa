module.exports = function(srcUrl) {
  var parsedUrl = require('url').parse(srcUrl),
    paths = parsedUrl.pathname.split('/')

  return parsedUrl.hash ? parsedUrl.hash : paths[paths.length - 1]
}
