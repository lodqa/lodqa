/*global Springy:true*/
module.exports = function(options, className) {
  const element = document.createElement('div')

  element.innerHTML = `
    <div class="${className.join(' ') || 'graph'}">
      <a target="_blank"></a>
      <canvas ${Object.entries(options).map((e) => `${e[0]}="${e[1]}"`).join(' ')}></canvas>
    </div>
    `

  const link = element.querySelector('a')
  const canvas = element.querySelector('canvas')
  const graph = new Springy.Graph()
  const springy = $(canvas).springy({
    graph
  })

  updateLinkOnSelect(link, springy)

  return [graph, element.children[0]]
}

function updateLinkOnSelect(link, springy) {
  springy.event
    .on('selected', (selected) => {
      link.textContent = selected.node.data.url
      link.setAttribute('href', selected.node.data.url)
    })
}
