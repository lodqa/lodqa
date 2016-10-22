const dashboard = document.querySelector('#dashboard'),
  results = document.querySelector('#results')

dashboard.addEventListener('click', () => {
  dashboard.style['z-index'] = 1
  results.style['z-index'] = -1
})

results.addEventListener('click', () => {
  dashboard.style['z-index'] = -1
  results.style['z-index'] = 1
})
