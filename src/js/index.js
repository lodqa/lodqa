const dashboard = document.querySelector('#dashboard')

dashboard.addEventListener('click', () => {
  dashboard.classList.remove('dashboard--back')
  results.classList.add('results--back')

  document.querySelector('.examples')
    .classList.add('examples--hidden')
})

const results = document.querySelector('#results')

results.addEventListener('click', () => {
  dashboard.classList.add('dashboard--back')
  results.classList.remove('results--back')
})

const execute_button = document.querySelector('#execute-button')

execute_button.addEventListener('click', (e) => {
  // Do not submit form.
  e.preventDefault()

  const form = document.querySelector('#nlqform')

  location.href = `/execute?query=${encodeURIComponent(form.query.value)}&target=${form.target.value}`
})
