const dashboard = document.querySelector('#dashboard'),
  results = document.querySelector('#results')

dashboard.addEventListener('click', () => {
  dashboard.classList.remove('dashboard--back')
  results.classList.add('results--back')
})

results.addEventListener('click', () => {
  dashboard.classList.add('dashboard--back')
  results.classList.remove('results--back')
})
