module.exports = function() {
  document.querySelector('#mode-button')
    .addEventListener('click', (e) => {
      // Do not validate the form
      e.stopPropagation()

      const form = document.querySelector('#nlqform')

      const parameters = [
        `target=${form.target.value}`,
        `read_timeout=${form.read_timeout.value}`
      ]

      if (form.query.value) {
        parameters.push(`query=${encodeURIComponent(form.query.value)}`)
      }

      if (location.pathname.includes('expert')) {
        location.href = `/?${parameters.join('&')}`
      } else {
        location.href = `/expert?${parameters.join('&')}`
      }
    })
}
