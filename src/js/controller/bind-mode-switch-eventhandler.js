module.exports = function(pathname) {
  document.querySelector('#mode-switch')
    .addEventListener('click', (e) => {
      // Do not validate the form.
      e.stopPropagation()

      // Do not add a # URL to the location history.
      e.preventDefault()

      const parameters = []

      const readTimeout = getReadTimeout()
      if(readTimeout){
        parameters.push(`read_timeout=${readTimeout}`)
      }

      const target = getTarget()
      if (target) {
        parameters.push(`target=${target}`)
      }

      const form = document.querySelector('#nlqform')
      if (form.query.value) {
        parameters.push(`query=${encodeURIComponent(form.query.value)}`)
      }

      location.href = `/${pathname}?${parameters.join('&')}`
    })
}

function getReadTimeout() {
  const parameter = new URL(location.href)
    .searchParams.get('read_timeout')
  if (parameter) {
    return decodeURIComponent(parameter)
  }
}

function getTarget() {
  // A user can select the target at the expert mode.
  const element = document.querySelector('#nlqform input[name="target"]')
  if (element) {
    return element.value
  }

  // The target is not chenged in the simple mode or the answer page.
  const parameter = new URL(location.href)
    .searchParams.get('target')
  if (parameter) {
    return decodeURIComponent(parameter)
  }
}
