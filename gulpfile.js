var gulp = require('gulp'),
  src = 'src/js/',
  js = 'lodqa-client.js'

gulp
  .task('browserify', function() {
    var browserify = require('gulp-browserify')

    gulp.src([src + js, src + 'lodqa-client2.js'])
      .pipe(browserify())
      .pipe(gulp.dest('public/js/'))
  })
  .task('auto_compile', function() {
    gulp.watch(src + '**', ['browserify'])
  })
  .task('default', ['browserify', 'auto_compile'])
