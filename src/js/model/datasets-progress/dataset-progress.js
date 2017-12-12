module.exports = class {
  constructor(name) {
    this.name = name
    this.max = 0
    this.value = 0
    this.show = false
  }

  get percentage() {
    return Math.floor(this.value / this.max * 1000) / 10
  }
}
