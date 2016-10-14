/*global Springy:true*/
module.exports = function(options, className) {
  const graph = new Springy.Graph()
  const link = $('<a target="_blank">')
  const canvas = $('<canvas>')
    .attr(options)

  const springy = canvas.springy({
    graph
  })

  updateLinkOnSelect(link, springy)

  const dom = $(`<div class="${className.join(' ') || 'graph'}">`)
    .append(link)
    .append(canvas)

  return [graph, dom]
}


function updateLinkOnSelect(link, springy) {
  springy.event
    .on('selected', (selected) => {
      link
        .text(selected.node.data.url)
        .attr('href', selected.node.data.url)
    })
}
