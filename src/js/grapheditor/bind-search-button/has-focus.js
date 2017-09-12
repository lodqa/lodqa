module.exports = function hasFocus(pgpElement) {
  if (!pgpElement.innerHTML.trim()) {
    return false
  }

  const pgp = JSON.parse(pgpElement.innerHTML.trim())

  return Boolean(pgp.focus)
}
