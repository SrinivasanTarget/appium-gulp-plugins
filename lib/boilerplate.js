"use strict";
var mocha = require('gulp-mocha'),
    Q = require('q'),
    Transpiler = require('../index').Transpiler,
    jshint = require('gulp-jshint'),
    jscs = require('gulp-jscs'),
    vinylPaths = require('vinyl-paths'),
    del = require('del'),
    _ = require('lodash');

var DEFAULT_OPTS = {
  files: ["*.js", "lib/**/*.js", "test/**/*.js", "!gulpfile.js"],
  transpile: true,
  transpileOut: "build",
  babelOpts: {},
  linkBabelRuntime: true,
  jscs: true,
  jshint: true,
  watch: true,
  test: true,
  testFiles: null,
  testReporter: 'nyan',
  testTimeout: 8000,
  buildName: null
};

var boilerplate = function (gulp, opts) {
  var spawnWatcher = require('../index').spawnWatcher.use(gulp);
  var runSequence = Q.denodeify(require('run-sequence').use(gulp));
  var defOpts = _.clone(DEFAULT_OPTS);
  _.extend(defOpts, opts);
  opts = defOpts;

  process.env.APPIUM_NOTIF_BUILD_NAME = opts.buildName;

  gulp.task('clean', function () {
    if (opts.transpile) {
      return gulp.src(opts.transpileOut, {read: false})
                 .pipe(vinylPaths(del));
    }
  });

  if (opts.test) {
    var testDeps = [];
    var testDir = 'test';
    if (opts.transpile) {
      testDeps.push('transpile');
      testDir = opts.transpileOut + '/test';
    }

    var testFiles = opts.testFiles ? opts.testFiles :
                                     testDir + '/**/*-specs.js';
    gulp.task('test', testDeps,  function () {
      var mochaOpts = {
        reporter: opts.testReporter,
        timeout: opts.testTimeout
      };
      // set env so our code knows when it's being run in a test env
      process.env._TESTING = true;
      var testProc = gulp
       .src(testFiles, {read: false})
       .pipe(mocha(mochaOpts))
       .on('error', spawnWatcher.handleError);
      process.env._TESTING = false;
      return testProc;
    });
  }

  if (opts.transpile) {
    gulp.task('transpile', function () {
      var transpiler = new Transpiler(opts.babelOpts);
      return gulp.src(opts.files, {base: './'})
        .pipe(transpiler.stream())
        .on('error', spawnWatcher.handleError)
        .pipe(gulp.dest(opts.transpileOut));
    });

    gulp.task('prepublish', function () {
      return runSequence('clean', 'transpile');
    });
  }

  var lintTasks = [];
  if (opts.jscs) {
    gulp.task('jscs', function () {
    console.log('running jscs');
      return gulp
       .src(opts.files)
       .pipe(jscs())
       .on('error', spawnWatcher.handleError);
    });
    lintTasks.push('jscs');
  }

  if (opts.jshint) {
    gulp.task('jshint', function () {
      return gulp
       .src(opts.files)
       .pipe(jshint())
       .pipe(jshint.reporter('jshint-stylish'))
       .pipe(jshint.reporter('fail'))
       .on('error', spawnWatcher.handleError);
    });
    lintTasks.push('jshint');
  }

  if (opts.jscs || opts.jshint) {
    opts.lint = true;
    gulp.task('lint', lintTasks);
  }

  var defaultSequence = [];
  if (opts.transpile) defaultSequence.push('clean');
  if (opts.lint) defaultSequence.push('lint');
  if (opts.transpile) defaultSequence.push('transpile');
  if (opts.test) defaultSequence.push('test');

  if (opts.watch) {
    spawnWatcher.clear(false);
    spawnWatcher.configure('watch', opts.files, function () {
      return runSequence.apply(null, defaultSequence);
    });
  }

  gulp.task('once', function () {
    return runSequence.apply(null, defaultSequence);
  });

  gulp.task('default', [opts.watch ? 'watch' : 'once']);
};

module.exports = {
  use: function (gulp) {
    return function (opts) {
      boilerplate(gulp, opts);
    };
  }
};