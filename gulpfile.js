var gulp = require('gulp'),
  babel = require('gulp-babel'),
  browserify = require('gulp-browserify'),
  src = 'src/js/',
  dist = 'public/js/'


const debug = require('gulp-debug');

gulp
  .task('browserify', function() {
    gulp.src(['aa', `${src}lodqa-client.js`, `${src}execute.js`])
      .pipe(debug({title: 'unicorn:'}))
      .pipe(browserify({
        transform: ['babelify']
      }))
      .pipe(gulp.dest(dist))
  })
  .task('babel', function() {
    return gulp.src([src + 'index.js', src + 'dashboard.js'])
      .pipe(babel())
      .pipe(gulp.dest(dist))
  })
  .task('auto_compile', function() {
    gulp.watch(src + '**', ['browserify'])
    gulp.watch(src + 'index.js', ['babel'])
    gulp.watch(src + 'dashboard.js', ['babel'])
  })
  .task('default', ['browserify', 'babel', 'auto_compile'])
