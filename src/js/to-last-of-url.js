module.exports = function(srcUrl) {
  const parsedUrl = require('url')
    .parse(srcUrl)
  const paths = parsedUrl.pathname.split('/')

  return parsedUrl.hash ? parsedUrl.hash : paths[paths.length - 1]
}
