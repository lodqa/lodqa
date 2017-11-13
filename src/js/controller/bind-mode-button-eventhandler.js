module.exports = function(pathname) {
  document.querySelector('#mode-button')
    .addEventListener('click', (e) => {
      // Do not validate the form
      e.stopPropagation()

      const form = document.querySelector('#nlqform')
      const parameters = [`read_timeout=${form.read_timeout.value}`]
      const target = getTarget()
      if (target) {
        parameters.push(`target=${target}`)
      }

      if (form.query.value) {
        parameters.push(`query=${encodeURIComponent(form.query.value)}`)
      }

      location.href = `/${pathname}?${parameters.join('&')}`
    })
}

function getTarget() {
  // A user can select the target at the expert mode.
  const element = document.querySelector('#target-value')
  if (element) {
    return element.value
  }

  // The target is not chenged in the simple mode or the answer page.
  const targetParameter = new URL(location.href).searchParams.get('target')
  if (targetParameter) {
    return decodeURIComponent(targetParameter)
  }
}
