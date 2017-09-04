module.exports = function bindExpertCheckboxEventhandler() {
  document.querySelector('#expert-checkbox')
    .addEventListener('click', (e) => {
      const form = document.querySelector('#nlqform')

      const parameters = [
        `target=${form.target.value}`,
        `read_timeout=${form.read_timeout.value}`
      ]

      if (form.query.value) {
        parameters.push(`query=${encodeURIComponent(form.query.value)}`)
      }

      if (e.target.checked) {

        location.href = `/expert?${parameters.join('&')}`
      } else {
        location.href = `/?${parameters.join('&')}`
      }
    })
}
