var gulp = require('gulp'),
  src_js = 'src/js/lodqa-client.js'

gulp
  .task('browserify', function() {
    var browserify = require('gulp-browserify')

    gulp.src(src_js)
      .pipe(browserify())
      .pipe(gulp.dest('public/js/'))
  })
  .task('auto_compile', function() {
    gulp.watch(src_js, ['browserify'])
  })
  .task('default', ['browserify', 'auto_compile'])
