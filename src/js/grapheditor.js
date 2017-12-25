const initDashboard = require('./controller/grapheditor/dashboard')

document.addEventListener('DOMContentLoaded', () => {
  initDashboard()

  const dashboard = document.querySelector('#dashboard')
  const results = document.querySelector('#results')

  dashboard.addEventListener('click', () => {
    dashboard.classList.remove('dashboard--back')
    results.classList.add('results--back')

    document.querySelector('.examples')
      .classList.add('examples--hidden')
  })

  results.addEventListener('click', () => {
    dashboard.classList.add('dashboard--back')
    results.classList.remove('results--back')
  })
})
