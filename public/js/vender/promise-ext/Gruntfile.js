'use strict';

module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt); // Load grunt tasks automatically
    require('time-grunt')(grunt); // Time how long tasks take. Can help when optimizing build times

    var options = {
        dev: grunt.option('dev')
    };

    // Define the configuration for all the tasks
    grunt.initConfig({
        // Configurable paths
        paths: {
            src: 'src',
            build: 'dist',
            lib: 'lib',
            temp: '.temp',
            test: 'tests'
        },
        pkg: grunt.file.readJSON("package.json"),

        typescript: {
            options: {
                target: "es3",
                module: "amd",
                sourceMap: false,
                declaration: false,
                comments: false,
                disallowbool: true,
                disallowimportmodule: true
            },
            dev: {
                src: "<%= paths.src %>/**/*.ts",
                options: {
                    sourceMap: true
                }
            },
            test: {
                src: "<%= paths.test %>/**/*.ts"
            },
            dist: {
                src: "<%= paths.src %>/**/*.ts",
                dest: "<%= paths.build %>/",
                options: {
                    basePath: '<%= paths.src %>'
                }
            },
            node: {
                src: "<%= paths.src %>/**/*.ts",
                dest: "<%= paths.lib %>/",
                options: {
                    target: "es5",
                    module: "commonjs",
                    basePath: '<%= paths.src %>'
                }
            }
        },

        requirejs: {
            release: {
                options: {
                    baseUrl: "<%= paths.build %>",
                    name: "../bower_components/almond/almond",
                    out: "<%= paths.build %>/promise.min.js",
                    optimize: "uglify2",
                    wrap: true,
                    include: [
                        "../promise-builder",
                        "promise/class",
                        "promise/extensions"
                    ],
                    insertRequire: ['promise']
                }
            }
        },

        jshint: {
            options: {
                jshintrc: "jshint.json",
            },

            base: ["*.js"],
            dev: ["<%= paths.src %>/**/*.js"],
            node: ["<%= paths.lib %>/**/*.js"],
            dist: ["<%= paths.build %>/**/*.js", "!<%= paths.build %>/**/*.min.js"],
            test: {
                options: {
                    '-W030': true,
                    '-W068': true,
                },
                src: "<%= paths.test %>/**/*.js"
            }
        },

        tslint: {
            options: {
                configuration: grunt.file.readJSON("tslint.json")
            },
            dev: {
                src: "<%= paths.src %>/**/*.ts"
            },
            test: {
                src: "<%= paths.test %>/**/*.ts"
            }
        },

        connect: {
            test: {
                options: {
                    port: "8080",
                    open: "http://localhost:8080/tests/index.html",
                    keepalive: true
                }
            }
        },

        mocha: {
            test: ["<%= paths.test %>/index.html"]
        },

        clean: {
            nuget: "nuget/*.nupkg",
            dev: [
                "<%= paths.src %>/**/*.d.ts",
                "!<%= paths.src %>/promise.d.ts",
                "<%= paths.src %>/**/*.js",
                "<%= paths.src %>/**/*.js.map"
            ],
            test: [
                "<%= paths.test %>/**/*.d.ts",
                "!<%= paths.test %>/tests.d.ts",
                "<%= paths.test %>/**/*.js",
                "<%= paths.test %>/**/*.js.map"
            ],
        },

        nugetpack: {
            all: {
                src: "nuget/*.nuspec",
                dest: "nuget/",

                options: {
                    version: "<%= pkg.version %>"
                }
            }
        },
        nugetpush: {
            all: {
                src: "nuget/*.<%= pkg.version %>.nupkg"
            }
        },

        watch: {
            tslint: {
                files: ['<%= tslint.dev.src %>'],
                tasks: ['tslint:dev']
            },
            jshint: {
                files: ['<%= jshint.dev.src %>'],
                tasks: ['jshint:dev']
            },
            test: {
                files: ['<%= paths.test %>/*.*'],
                tasks: ['test']
            },
            gruntfile: {
                files: ['Gruntfile.js']
            }
        }
    });

    grunt.registerTask("build", ["tslint:dev", "typescript:dist", "jshint:dist", "requirejs", "typescript:node", "jshint:node"]);
    grunt.registerTask("dev", ["tslint:dev", "typescript:dev", "jshint:dev"]);
    grunt.registerTask("test", ["tslint:test", "dev", "typescript:test", "jshint:test", "mocha:test"]);
    grunt.registerTask("nuget", ["nugetpack", "nugetpush"]);

    grunt.registerTask("default", ["clean", "build", "test"]);
};