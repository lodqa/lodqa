(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,__filename){
/** vim: et:ts=4:sw=4:sts=4
 * @license amdefine 1.0.1 Copyright (c) 2011-2016, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/amdefine for details
 */

/*jslint node: true */
/*global module, process */
'use strict';

/**
 * Creates a define for node.
 * @param {Object} module the "module" object that is defined by Node for the
 * current module.
 * @param {Function} [requireFn]. Node's require function for the current module.
 * It only needs to be passed in Node versions before 0.5, when module.require
 * did not exist.
 * @returns {Function} a define function that is usable for the current node
 * module.
 */
function amdefine(module, requireFn) {
    'use strict';
    var defineCache = {},
        loaderCache = {},
        alreadyCalled = false,
        path = require('path'),
        makeRequire, stringRequire;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i+= 1) {
            part = ary[i];
            if (part === '.') {
                ary.splice(i, 1);
                i -= 1;
            } else if (part === '..') {
                if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                    //End of the line. Keep at least one non-dot
                    //path segment at the front so it can be mapped
                    //correctly to disk. Otherwise, there is likely
                    //no path mapping for a path starting with '..'.
                    //This can still fail, but catches the most reasonable
                    //uses of ..
                    break;
                } else if (i > 0) {
                    ary.splice(i - 1, 2);
                    i -= 2;
                }
            }
        }
    }

    function normalize(name, baseName) {
        var baseParts;

        //Adjust any relative paths.
        if (name && name.charAt(0) === '.') {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                baseParts = baseName.split('/');
                baseParts = baseParts.slice(0, baseParts.length - 1);
                baseParts = baseParts.concat(name.split('/'));
                trimDots(baseParts);
                name = baseParts.join('/');
            }
        }

        return name;
    }

    /**
     * Create the normalize() function passed to a loader plugin's
     * normalize method.
     */
    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(id) {
        function load(value) {
            loaderCache[id] = value;
        }

        load.fromText = function (id, text) {
            //This one is difficult because the text can/probably uses
            //define, and any relative paths and requires should be relative
            //to that id was it would be found on disk. But this would require
            //bootstrapping a module/require fairly deeply from node core.
            //Not sure how best to go about that yet.
            throw new Error('amdefine does not implement load.fromText');
        };

        return load;
    }

    makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
            if (typeof deps === 'string') {
                //Synchronous, single module require('')
                return stringRequire(systemRequire, exports, module, deps, relId);
            } else {
                //Array of dependencies with a callback.

                //Convert the dependencies to modules.
                deps = deps.map(function (depName) {
                    return stringRequire(systemRequire, exports, module, depName, relId);
                });

                //Wait for next tick to call back the require call.
                if (callback) {
                    process.nextTick(function () {
                        callback.apply(null, deps);
                    });
                }
            }
        }

        amdRequire.toUrl = function (filePath) {
            if (filePath.indexOf('.') === 0) {
                return normalize(filePath, path.dirname(module.filename));
            } else {
                return filePath;
            }
        };

        return amdRequire;
    };

    //Favor explicit value, passed in if the module wants to support Node 0.4.
    requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
    };

    function runFactory(id, deps, factory) {
        var r, e, m, result;

        if (id) {
            e = loaderCache[id] = {};
            m = {
                id: id,
                uri: __filename,
                exports: e
            };
            r = makeRequire(requireFn, e, m, id);
        } else {
            //Only support one define call per file
            if (alreadyCalled) {
                throw new Error('amdefine with no module ID cannot be called more than once per file.');
            }
            alreadyCalled = true;

            //Use the real variables from node
            //Use module.exports for exports, since
            //the exports in here is amdefine exports.
            e = module.exports;
            m = module;
            r = makeRequire(requireFn, e, m, module.id);
        }

        //If there are dependencies, they are strings, so need
        //to convert them to dependency values.
        if (deps) {
            deps = deps.map(function (depName) {
                return r(depName);
            });
        }

        //Call the factory with the right dependencies.
        if (typeof factory === 'function') {
            result = factory.apply(m.exports, deps);
        } else {
            result = factory;
        }

        if (result !== undefined) {
            m.exports = result;
            if (id) {
                loaderCache[id] = m.exports;
            }
        }
    }

    stringRequire = function (systemRequire, exports, module, id, relId) {
        //Split the ID by a ! so that
        var index = id.indexOf('!'),
            originalId = id,
            prefix, plugin;

        if (index === -1) {
            id = normalize(id, relId);

            //Straight module lookup. If it is one of the special dependencies,
            //deal with it, otherwise, delegate to node.
            if (id === 'require') {
                return makeRequire(systemRequire, exports, module, relId);
            } else if (id === 'exports') {
                return exports;
            } else if (id === 'module') {
                return module;
            } else if (loaderCache.hasOwnProperty(id)) {
                return loaderCache[id];
            } else if (defineCache[id]) {
                runFactory.apply(null, defineCache[id]);
                return loaderCache[id];
            } else {
                if(systemRequire) {
                    return systemRequire(originalId);
                } else {
                    throw new Error('No module with ID: ' + id);
                }
            }
        } else {
            //There is a plugin in play.
            prefix = id.substring(0, index);
            id = id.substring(index + 1, id.length);

            plugin = stringRequire(systemRequire, exports, module, prefix, relId);

            if (plugin.normalize) {
                id = plugin.normalize(id, makeNormalize(relId));
            } else {
                //Normalize the ID normally.
                id = normalize(id, relId);
            }

            if (loaderCache[id]) {
                return loaderCache[id];
            } else {
                plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});

                return loaderCache[id];
            }
        }
    };

    //Create a define function specific to the module asking for amdefine.
    function define(id, deps, factory) {
        if (Array.isArray(id)) {
            factory = deps;
            deps = id;
            id = undefined;
        } else if (typeof id !== 'string') {
            factory = id;
            id = deps = undefined;
        }

        if (deps && !Array.isArray(deps)) {
            factory = deps;
            deps = undefined;
        }

        if (!deps) {
            deps = ['require', 'exports', 'module'];
        }

        //Set up properties for this module. If an ID, then use
        //internal cache. If no ID, then use the external variables
        //for this node module.
        if (id) {
            //Put the module in deep freeze until there is a
            //require call for it.
            defineCache[id] = [id, deps, factory];
        } else {
            runFactory(id, deps, factory);
        }
    }

    //define.require, which has access to all the values in the
    //cache. Useful for AMD modules that all have IDs in the file,
    //but need to finally export a value to node based on one of those
    //IDs.
    define.require = function (id) {
        if (loaderCache[id]) {
            return loaderCache[id];
        }

        if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
        }
    };

    define.amd = {};

    return define;
}

module.exports = amdefine;

}).call(this,require('_process'),"/node_modules/amdefine/amdefine.js")

},{"_process":45,"path":44}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _handlebarsRuntime = require('./handlebars.runtime');

var _handlebarsRuntime2 = _interopRequireDefault(_handlebarsRuntime);

// Compiler imports

var _handlebarsCompilerAst = require('./handlebars/compiler/ast');

var _handlebarsCompilerAst2 = _interopRequireDefault(_handlebarsCompilerAst);

var _handlebarsCompilerBase = require('./handlebars/compiler/base');

var _handlebarsCompilerCompiler = require('./handlebars/compiler/compiler');

var _handlebarsCompilerJavascriptCompiler = require('./handlebars/compiler/javascript-compiler');

var _handlebarsCompilerJavascriptCompiler2 = _interopRequireDefault(_handlebarsCompilerJavascriptCompiler);

var _handlebarsCompilerVisitor = require('./handlebars/compiler/visitor');

var _handlebarsCompilerVisitor2 = _interopRequireDefault(_handlebarsCompilerVisitor);

var _handlebarsNoConflict = require('./handlebars/no-conflict');

var _handlebarsNoConflict2 = _interopRequireDefault(_handlebarsNoConflict);

var _create = _handlebarsRuntime2['default'].create;
function create() {
  var hb = _create();

  hb.compile = function (input, options) {
    return _handlebarsCompilerCompiler.compile(input, options, hb);
  };
  hb.precompile = function (input, options) {
    return _handlebarsCompilerCompiler.precompile(input, options, hb);
  };

  hb.AST = _handlebarsCompilerAst2['default'];
  hb.Compiler = _handlebarsCompilerCompiler.Compiler;
  hb.JavaScriptCompiler = _handlebarsCompilerJavascriptCompiler2['default'];
  hb.Parser = _handlebarsCompilerBase.parser;
  hb.parse = _handlebarsCompilerBase.parse;

  return hb;
}

var inst = create();
inst.create = create;

_handlebarsNoConflict2['default'](inst);

inst.Visitor = _handlebarsCompilerVisitor2['default'];

inst['default'] = inst;

exports['default'] = inst;
module.exports = exports['default'];


},{"./handlebars.runtime":4,"./handlebars/compiler/ast":6,"./handlebars/compiler/base":7,"./handlebars/compiler/compiler":9,"./handlebars/compiler/javascript-compiler":11,"./handlebars/compiler/visitor":14,"./handlebars/no-conflict":28}],4:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _handlebarsBase = require('./handlebars/base');

var base = _interopRequireWildcard(_handlebarsBase);

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)

var _handlebarsSafeString = require('./handlebars/safe-string');

var _handlebarsSafeString2 = _interopRequireDefault(_handlebarsSafeString);

var _handlebarsException = require('./handlebars/exception');

var _handlebarsException2 = _interopRequireDefault(_handlebarsException);

var _handlebarsUtils = require('./handlebars/utils');

var Utils = _interopRequireWildcard(_handlebarsUtils);

var _handlebarsRuntime = require('./handlebars/runtime');

var runtime = _interopRequireWildcard(_handlebarsRuntime);

var _handlebarsNoConflict = require('./handlebars/no-conflict');

var _handlebarsNoConflict2 = _interopRequireDefault(_handlebarsNoConflict);

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
function create() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = _handlebarsSafeString2['default'];
  hb.Exception = _handlebarsException2['default'];
  hb.Utils = Utils;
  hb.escapeExpression = Utils.escapeExpression;

  hb.VM = runtime;
  hb.template = function (spec) {
    return runtime.template(spec, hb);
  };

  return hb;
}

var inst = create();
inst.create = create;

_handlebarsNoConflict2['default'](inst);

inst['default'] = inst;

exports['default'] = inst;
module.exports = exports['default'];


},{"./handlebars/base":5,"./handlebars/exception":18,"./handlebars/no-conflict":28,"./handlebars/runtime":29,"./handlebars/safe-string":30,"./handlebars/utils":31}],5:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.HandlebarsEnvironment = HandlebarsEnvironment;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _utils = require('./utils');

var _exception = require('./exception');

var _exception2 = _interopRequireDefault(_exception);

var _helpers = require('./helpers');

var _decorators = require('./decorators');

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var VERSION = '4.0.11';
exports.VERSION = VERSION;
var COMPILER_REVISION = 7;

exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '== 1.x.x',
  5: '== 2.0.0-alpha.x',
  6: '>= 2.0.0-beta.1',
  7: '>= 4.0.0'
};

exports.REVISION_CHANGES = REVISION_CHANGES;
var objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials, decorators) {
  this.helpers = helpers || {};
  this.partials = partials || {};
  this.decorators = decorators || {};

  _helpers.registerDefaultHelpers(this);
  _decorators.registerDefaultDecorators(this);
}

HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: _logger2['default'],
  log: _logger2['default'].log,

  registerHelper: function registerHelper(name, fn) {
    if (_utils.toString.call(name) === objectType) {
      if (fn) {
        throw new _exception2['default']('Arg not supported with multiple helpers');
      }
      _utils.extend(this.helpers, name);
    } else {
      this.helpers[name] = fn;
    }
  },
  unregisterHelper: function unregisterHelper(name) {
    delete this.helpers[name];
  },

  registerPartial: function registerPartial(name, partial) {
    if (_utils.toString.call(name) === objectType) {
      _utils.extend(this.partials, name);
    } else {
      if (typeof partial === 'undefined') {
        throw new _exception2['default']('Attempting to register a partial called "' + name + '" as undefined');
      }
      this.partials[name] = partial;
    }
  },
  unregisterPartial: function unregisterPartial(name) {
    delete this.partials[name];
  },

  registerDecorator: function registerDecorator(name, fn) {
    if (_utils.toString.call(name) === objectType) {
      if (fn) {
        throw new _exception2['default']('Arg not supported with multiple decorators');
      }
      _utils.extend(this.decorators, name);
    } else {
      this.decorators[name] = fn;
    }
  },
  unregisterDecorator: function unregisterDecorator(name) {
    delete this.decorators[name];
  }
};

var log = _logger2['default'].log;

exports.log = log;
exports.createFrame = _utils.createFrame;
exports.logger = _logger2['default'];


},{"./decorators":16,"./exception":18,"./helpers":19,"./logger":27,"./utils":31}],6:[function(require,module,exports){
'use strict';

exports.__esModule = true;
var AST = {
  // Public API used to evaluate derived attributes regarding AST nodes
  helpers: {
    // a mustache is definitely a helper if:
    // * it is an eligible helper, and
    // * it has at least one parameter or hash segment
    helperExpression: function helperExpression(node) {
      return node.type === 'SubExpression' || (node.type === 'MustacheStatement' || node.type === 'BlockStatement') && !!(node.params && node.params.length || node.hash);
    },

    scopedId: function scopedId(path) {
      return (/^\.|this\b/.test(path.original)
      );
    },

    // an ID is simple if it only has one part, and that part is not
    // `..` or `this`.
    simpleId: function simpleId(path) {
      return path.parts.length === 1 && !AST.helpers.scopedId(path) && !path.depth;
    }
  }
};

// Must be exported as an object rather than the root of the module as the jison lexer
// must modify the object to operate properly.
exports['default'] = AST;
module.exports = exports['default'];


},{}],7:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.parse = parse;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _parser = require('./parser');

var _parser2 = _interopRequireDefault(_parser);

var _whitespaceControl = require('./whitespace-control');

var _whitespaceControl2 = _interopRequireDefault(_whitespaceControl);

var _helpers = require('./helpers');

var Helpers = _interopRequireWildcard(_helpers);

var _utils = require('../utils');

exports.parser = _parser2['default'];

var yy = {};
_utils.extend(yy, Helpers);

function parse(input, options) {
  // Just return if an already-compiled AST was passed in.
  if (input.type === 'Program') {
    return input;
  }

  _parser2['default'].yy = yy;

  // Altering the shared object here, but this is ok as parser is a sync operation
  yy.locInfo = function (locInfo) {
    return new yy.SourceLocation(options && options.srcName, locInfo);
  };

  var strip = new _whitespaceControl2['default'](options);
  return strip.accept(_parser2['default'].parse(input));
}


},{"../utils":31,"./helpers":10,"./parser":12,"./whitespace-control":15}],8:[function(require,module,exports){
/* global define */
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

var SourceNode = undefined;

try {
  /* istanbul ignore next */
  if (typeof define !== 'function' || !define.amd) {
    // We don't support this in AMD environments. For these environments, we asusme that
    // they are running on the browser and thus have no need for the source-map library.
    var SourceMap = require('source-map');
    SourceNode = SourceMap.SourceNode;
  }
} catch (err) {}
/* NOP */

/* istanbul ignore if: tested but not covered in istanbul due to dist build  */
if (!SourceNode) {
  SourceNode = function (line, column, srcFile, chunks) {
    this.src = '';
    if (chunks) {
      this.add(chunks);
    }
  };
  /* istanbul ignore next */
  SourceNode.prototype = {
    add: function add(chunks) {
      if (_utils.isArray(chunks)) {
        chunks = chunks.join('');
      }
      this.src += chunks;
    },
    prepend: function prepend(chunks) {
      if (_utils.isArray(chunks)) {
        chunks = chunks.join('');
      }
      this.src = chunks + this.src;
    },
    toStringWithSourceMap: function toStringWithSourceMap() {
      return { code: this.toString() };
    },
    toString: function toString() {
      return this.src;
    }
  };
}

function castChunk(chunk, codeGen, loc) {
  if (_utils.isArray(chunk)) {
    var ret = [];

    for (var i = 0, len = chunk.length; i < len; i++) {
      ret.push(codeGen.wrap(chunk[i], loc));
    }
    return ret;
  } else if (typeof chunk === 'boolean' || typeof chunk === 'number') {
    // Handle primitives that the SourceNode will throw up on
    return chunk + '';
  }
  return chunk;
}

function CodeGen(srcFile) {
  this.srcFile = srcFile;
  this.source = [];
}

CodeGen.prototype = {
  isEmpty: function isEmpty() {
    return !this.source.length;
  },
  prepend: function prepend(source, loc) {
    this.source.unshift(this.wrap(source, loc));
  },
  push: function push(source, loc) {
    this.source.push(this.wrap(source, loc));
  },

  merge: function merge() {
    var source = this.empty();
    this.each(function (line) {
      source.add(['  ', line, '\n']);
    });
    return source;
  },

  each: function each(iter) {
    for (var i = 0, len = this.source.length; i < len; i++) {
      iter(this.source[i]);
    }
  },

  empty: function empty() {
    var loc = this.currentLocation || { start: {} };
    return new SourceNode(loc.start.line, loc.start.column, this.srcFile);
  },
  wrap: function wrap(chunk) {
    var loc = arguments.length <= 1 || arguments[1] === undefined ? this.currentLocation || { start: {} } : arguments[1];

    if (chunk instanceof SourceNode) {
      return chunk;
    }

    chunk = castChunk(chunk, this, loc);

    return new SourceNode(loc.start.line, loc.start.column, this.srcFile, chunk);
  },

  functionCall: function functionCall(fn, type, params) {
    params = this.generateList(params);
    return this.wrap([fn, type ? '.' + type + '(' : '(', params, ')']);
  },

  quotedString: function quotedString(str) {
    return '"' + (str + '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028') // Per Ecma-262 7.3 + 7.8.4
    .replace(/\u2029/g, '\\u2029') + '"';
  },

  objectLiteral: function objectLiteral(obj) {
    var pairs = [];

    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var value = castChunk(obj[key], this);
        if (value !== 'undefined') {
          pairs.push([this.quotedString(key), ':', value]);
        }
      }
    }

    var ret = this.generateList(pairs);
    ret.prepend('{');
    ret.add('}');
    return ret;
  },

  generateList: function generateList(entries) {
    var ret = this.empty();

    for (var i = 0, len = entries.length; i < len; i++) {
      if (i) {
        ret.add(',');
      }

      ret.add(castChunk(entries[i], this));
    }

    return ret;
  },

  generateArray: function generateArray(entries) {
    var ret = this.generateList(entries);
    ret.prepend('[');
    ret.add(']');

    return ret;
  }
};

exports['default'] = CodeGen;
module.exports = exports['default'];


},{"../utils":31,"source-map":33}],9:[function(require,module,exports){
/* eslint-disable new-cap */

'use strict';

exports.__esModule = true;
exports.Compiler = Compiler;
exports.precompile = precompile;
exports.compile = compile;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

var _utils = require('../utils');

var _ast = require('./ast');

var _ast2 = _interopRequireDefault(_ast);

var slice = [].slice;

function Compiler() {}

// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  equals: function equals(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || !argEquals(opcode.args, otherOpcode.args)) {
        return false;
      }
    }

    // We know that length is the same between the two arrays because they are directly tied
    // to the opcode behavior above.
    len = this.children.length;
    for (var i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function compile(program, options) {
    this.sourceNode = [];
    this.opcodes = [];
    this.children = [];
    this.options = options;
    this.stringParams = options.stringParams;
    this.trackIds = options.trackIds;

    options.blockParams = options.blockParams || [];

    // These changes will propagate to the other compiler components
    var knownHelpers = options.knownHelpers;
    options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true,
      'lookup': true
    };
    if (knownHelpers) {
      for (var _name in knownHelpers) {
        /* istanbul ignore else */
        if (_name in knownHelpers) {
          this.options.knownHelpers[_name] = knownHelpers[_name];
        }
      }
    }

    return this.accept(program);
  },

  compileProgram: function compileProgram(program) {
    var childCompiler = new this.compiler(),
        // eslint-disable-line new-cap
    result = childCompiler.compile(program, this.options),
        guid = this.guid++;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;
    this.useDepths = this.useDepths || result.useDepths;

    return guid;
  },

  accept: function accept(node) {
    /* istanbul ignore next: Sanity code */
    if (!this[node.type]) {
      throw new _exception2['default']('Unknown type: ' + node.type, node);
    }

    this.sourceNode.unshift(node);
    var ret = this[node.type](node);
    this.sourceNode.shift();
    return ret;
  },

  Program: function Program(program) {
    this.options.blockParams.unshift(program.blockParams);

    var body = program.body,
        bodyLength = body.length;
    for (var i = 0; i < bodyLength; i++) {
      this.accept(body[i]);
    }

    this.options.blockParams.shift();

    this.isSimple = bodyLength === 1;
    this.blockParams = program.blockParams ? program.blockParams.length : 0;

    return this;
  },

  BlockStatement: function BlockStatement(block) {
    transformLiteralToPath(block);

    var program = block.program,
        inverse = block.inverse;

    program = program && this.compileProgram(program);
    inverse = inverse && this.compileProgram(inverse);

    var type = this.classifySexpr(block);

    if (type === 'helper') {
      this.helperSexpr(block, program, inverse);
    } else if (type === 'simple') {
      this.simpleSexpr(block);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue', block.path.original);
    } else {
      this.ambiguousSexpr(block, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  DecoratorBlock: function DecoratorBlock(decorator) {
    var program = decorator.program && this.compileProgram(decorator.program);
    var params = this.setupFullMustacheParams(decorator, program, undefined),
        path = decorator.path;

    this.useDecorators = true;
    this.opcode('registerDecorator', params.length, path.original);
  },

  PartialStatement: function PartialStatement(partial) {
    this.usePartial = true;

    var program = partial.program;
    if (program) {
      program = this.compileProgram(partial.program);
    }

    var params = partial.params;
    if (params.length > 1) {
      throw new _exception2['default']('Unsupported number of partial arguments: ' + params.length, partial);
    } else if (!params.length) {
      if (this.options.explicitPartialContext) {
        this.opcode('pushLiteral', 'undefined');
      } else {
        params.push({ type: 'PathExpression', parts: [], depth: 0 });
      }
    }

    var partialName = partial.name.original,
        isDynamic = partial.name.type === 'SubExpression';
    if (isDynamic) {
      this.accept(partial.name);
    }

    this.setupFullMustacheParams(partial, program, undefined, true);

    var indent = partial.indent || '';
    if (this.options.preventIndent && indent) {
      this.opcode('appendContent', indent);
      indent = '';
    }

    this.opcode('invokePartial', isDynamic, partialName, indent);
    this.opcode('append');
  },
  PartialBlockStatement: function PartialBlockStatement(partialBlock) {
    this.PartialStatement(partialBlock);
  },

  MustacheStatement: function MustacheStatement(mustache) {
    this.SubExpression(mustache);

    if (mustache.escaped && !this.options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },
  Decorator: function Decorator(decorator) {
    this.DecoratorBlock(decorator);
  },

  ContentStatement: function ContentStatement(content) {
    if (content.value) {
      this.opcode('appendContent', content.value);
    }
  },

  CommentStatement: function CommentStatement() {},

  SubExpression: function SubExpression(sexpr) {
    transformLiteralToPath(sexpr);
    var type = this.classifySexpr(sexpr);

    if (type === 'simple') {
      this.simpleSexpr(sexpr);
    } else if (type === 'helper') {
      this.helperSexpr(sexpr);
    } else {
      this.ambiguousSexpr(sexpr);
    }
  },
  ambiguousSexpr: function ambiguousSexpr(sexpr, program, inverse) {
    var path = sexpr.path,
        name = path.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', path.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    path.strict = true;
    this.accept(path);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleSexpr: function simpleSexpr(sexpr) {
    var path = sexpr.path;
    path.strict = true;
    this.accept(path);
    this.opcode('resolvePossibleLambda');
  },

  helperSexpr: function helperSexpr(sexpr, program, inverse) {
    var params = this.setupFullMustacheParams(sexpr, program, inverse),
        path = sexpr.path,
        name = path.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new _exception2['default']('You specified knownHelpersOnly, but used the unknown helper ' + name, sexpr);
    } else {
      path.strict = true;
      path.falsy = true;

      this.accept(path);
      this.opcode('invokeHelper', params.length, path.original, _ast2['default'].helpers.simpleId(path));
    }
  },

  PathExpression: function PathExpression(path) {
    this.addDepth(path.depth);
    this.opcode('getContext', path.depth);

    var name = path.parts[0],
        scoped = _ast2['default'].helpers.scopedId(path),
        blockParamId = !path.depth && !scoped && this.blockParamIndex(name);

    if (blockParamId) {
      this.opcode('lookupBlockParam', blockParamId, path.parts);
    } else if (!name) {
      // Context reference, i.e. `{{foo .}}` or `{{foo ..}}`
      this.opcode('pushContext');
    } else if (path.data) {
      this.options.data = true;
      this.opcode('lookupData', path.depth, path.parts, path.strict);
    } else {
      this.opcode('lookupOnContext', path.parts, path.falsy, path.strict, scoped);
    }
  },

  StringLiteral: function StringLiteral(string) {
    this.opcode('pushString', string.value);
  },

  NumberLiteral: function NumberLiteral(number) {
    this.opcode('pushLiteral', number.value);
  },

  BooleanLiteral: function BooleanLiteral(bool) {
    this.opcode('pushLiteral', bool.value);
  },

  UndefinedLiteral: function UndefinedLiteral() {
    this.opcode('pushLiteral', 'undefined');
  },

  NullLiteral: function NullLiteral() {
    this.opcode('pushLiteral', 'null');
  },

  Hash: function Hash(hash) {
    var pairs = hash.pairs,
        i = 0,
        l = pairs.length;

    this.opcode('pushHash');

    for (; i < l; i++) {
      this.pushParam(pairs[i].value);
    }
    while (i--) {
      this.opcode('assignToHash', pairs[i].key);
    }
    this.opcode('popHash');
  },

  // HELPERS
  opcode: function opcode(name) {
    this.opcodes.push({ opcode: name, args: slice.call(arguments, 1), loc: this.sourceNode[0].loc });
  },

  addDepth: function addDepth(depth) {
    if (!depth) {
      return;
    }

    this.useDepths = true;
  },

  classifySexpr: function classifySexpr(sexpr) {
    var isSimple = _ast2['default'].helpers.simpleId(sexpr.path);

    var isBlockParam = isSimple && !!this.blockParamIndex(sexpr.path.parts[0]);

    // a mustache is an eligible helper if:
    // * its id is simple (a single part, not `this` or `..`)
    var isHelper = !isBlockParam && _ast2['default'].helpers.helperExpression(sexpr);

    // if a mustache is an eligible helper but not a definite
    // helper, it is ambiguous, and will be resolved in a later
    // pass or at runtime.
    var isEligible = !isBlockParam && (isHelper || isSimple);

    // if ambiguous, we can possibly resolve the ambiguity now
    // An eligible helper is one that does not have a complex path, i.e. `this.foo`, `../foo` etc.
    if (isEligible && !isHelper) {
      var _name2 = sexpr.path.parts[0],
          options = this.options;

      if (options.knownHelpers[_name2]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) {
      return 'helper';
    } else if (isEligible) {
      return 'ambiguous';
    } else {
      return 'simple';
    }
  },

  pushParams: function pushParams(params) {
    for (var i = 0, l = params.length; i < l; i++) {
      this.pushParam(params[i]);
    }
  },

  pushParam: function pushParam(val) {
    var value = val.value != null ? val.value : val.original || '';

    if (this.stringParams) {
      if (value.replace) {
        value = value.replace(/^(\.?\.\/)*/g, '').replace(/\//g, '.');
      }

      if (val.depth) {
        this.addDepth(val.depth);
      }
      this.opcode('getContext', val.depth || 0);
      this.opcode('pushStringParam', value, val.type);

      if (val.type === 'SubExpression') {
        // SubExpressions get evaluated and passed in
        // in string params mode.
        this.accept(val);
      }
    } else {
      if (this.trackIds) {
        var blockParamIndex = undefined;
        if (val.parts && !_ast2['default'].helpers.scopedId(val) && !val.depth) {
          blockParamIndex = this.blockParamIndex(val.parts[0]);
        }
        if (blockParamIndex) {
          var blockParamChild = val.parts.slice(1).join('.');
          this.opcode('pushId', 'BlockParam', blockParamIndex, blockParamChild);
        } else {
          value = val.original || value;
          if (value.replace) {
            value = value.replace(/^this(?:\.|$)/, '').replace(/^\.\//, '').replace(/^\.$/, '');
          }

          this.opcode('pushId', val.type, value);
        }
      }
      this.accept(val);
    }
  },

  setupFullMustacheParams: function setupFullMustacheParams(sexpr, program, inverse, omitEmpty) {
    var params = sexpr.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if (sexpr.hash) {
      this.accept(sexpr.hash);
    } else {
      this.opcode('emptyHash', omitEmpty);
    }

    return params;
  },

  blockParamIndex: function blockParamIndex(name) {
    for (var depth = 0, len = this.options.blockParams.length; depth < len; depth++) {
      var blockParams = this.options.blockParams[depth],
          param = blockParams && _utils.indexOf(blockParams, name);
      if (blockParams && param >= 0) {
        return [depth, param];
      }
    }
  }
};

function precompile(input, options, env) {
  if (input == null || typeof input !== 'string' && input.type !== 'Program') {
    throw new _exception2['default']('You must pass a string or Handlebars AST to Handlebars.precompile. You passed ' + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var ast = env.parse(input, options),
      environment = new env.Compiler().compile(ast, options);
  return new env.JavaScriptCompiler().compile(environment, options);
}

function compile(input, options, env) {
  if (options === undefined) options = {};

  if (input == null || typeof input !== 'string' && input.type !== 'Program') {
    throw new _exception2['default']('You must pass a string or Handlebars AST to Handlebars.compile. You passed ' + input);
  }

  options = _utils.extend({}, options);
  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var compiled = undefined;

  function compileInput() {
    var ast = env.parse(input, options),
        environment = new env.Compiler().compile(ast, options),
        templateSpec = new env.JavaScriptCompiler().compile(environment, options, undefined, true);
    return env.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  function ret(context, execOptions) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled.call(this, context, execOptions);
  }
  ret._setup = function (setupOptions) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._setup(setupOptions);
  };
  ret._child = function (i, data, blockParams, depths) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._child(i, data, blockParams, depths);
  };
  return ret;
}

function argEquals(a, b) {
  if (a === b) {
    return true;
  }

  if (_utils.isArray(a) && _utils.isArray(b) && a.length === b.length) {
    for (var i = 0; i < a.length; i++) {
      if (!argEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
}

function transformLiteralToPath(sexpr) {
  if (!sexpr.path.parts) {
    var literal = sexpr.path;
    // Casting to string here to make false and 0 literal values play nicely with the rest
    // of the system.
    sexpr.path = {
      type: 'PathExpression',
      data: false,
      depth: 0,
      parts: [literal.original + ''],
      original: literal.original + '',
      loc: literal.loc
    };
  }
}


},{"../exception":18,"../utils":31,"./ast":6}],10:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.SourceLocation = SourceLocation;
exports.id = id;
exports.stripFlags = stripFlags;
exports.stripComment = stripComment;
exports.preparePath = preparePath;
exports.prepareMustache = prepareMustache;
exports.prepareRawBlock = prepareRawBlock;
exports.prepareBlock = prepareBlock;
exports.prepareProgram = prepareProgram;
exports.preparePartialBlock = preparePartialBlock;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

function validateClose(open, close) {
  close = close.path ? close.path.original : close;

  if (open.path.original !== close) {
    var errorNode = { loc: open.path.loc };

    throw new _exception2['default'](open.path.original + " doesn't match " + close, errorNode);
  }
}

function SourceLocation(source, locInfo) {
  this.source = source;
  this.start = {
    line: locInfo.first_line,
    column: locInfo.first_column
  };
  this.end = {
    line: locInfo.last_line,
    column: locInfo.last_column
  };
}

function id(token) {
  if (/^\[.*\]$/.test(token)) {
    return token.substr(1, token.length - 2);
  } else {
    return token;
  }
}

function stripFlags(open, close) {
  return {
    open: open.charAt(2) === '~',
    close: close.charAt(close.length - 3) === '~'
  };
}

function stripComment(comment) {
  return comment.replace(/^\{\{~?\!-?-?/, '').replace(/-?-?~?\}\}$/, '');
}

function preparePath(data, parts, loc) {
  loc = this.locInfo(loc);

  var original = data ? '@' : '',
      dig = [],
      depth = 0,
      depthString = '';

  for (var i = 0, l = parts.length; i < l; i++) {
    var part = parts[i].part,

    // If we have [] syntax then we do not treat path references as operators,
    // i.e. foo.[this] resolves to approximately context.foo['this']
    isLiteral = parts[i].original !== part;
    original += (parts[i].separator || '') + part;

    if (!isLiteral && (part === '..' || part === '.' || part === 'this')) {
      if (dig.length > 0) {
        throw new _exception2['default']('Invalid path: ' + original, { loc: loc });
      } else if (part === '..') {
        depth++;
        depthString += '../';
      }
    } else {
      dig.push(part);
    }
  }

  return {
    type: 'PathExpression',
    data: data,
    depth: depth,
    parts: dig,
    original: original,
    loc: loc
  };
}

function prepareMustache(path, params, hash, open, strip, locInfo) {
  // Must use charAt to support IE pre-10
  var escapeFlag = open.charAt(3) || open.charAt(2),
      escaped = escapeFlag !== '{' && escapeFlag !== '&';

  var decorator = /\*/.test(open);
  return {
    type: decorator ? 'Decorator' : 'MustacheStatement',
    path: path,
    params: params,
    hash: hash,
    escaped: escaped,
    strip: strip,
    loc: this.locInfo(locInfo)
  };
}

function prepareRawBlock(openRawBlock, contents, close, locInfo) {
  validateClose(openRawBlock, close);

  locInfo = this.locInfo(locInfo);
  var program = {
    type: 'Program',
    body: contents,
    strip: {},
    loc: locInfo
  };

  return {
    type: 'BlockStatement',
    path: openRawBlock.path,
    params: openRawBlock.params,
    hash: openRawBlock.hash,
    program: program,
    openStrip: {},
    inverseStrip: {},
    closeStrip: {},
    loc: locInfo
  };
}

function prepareBlock(openBlock, program, inverseAndProgram, close, inverted, locInfo) {
  if (close && close.path) {
    validateClose(openBlock, close);
  }

  var decorator = /\*/.test(openBlock.open);

  program.blockParams = openBlock.blockParams;

  var inverse = undefined,
      inverseStrip = undefined;

  if (inverseAndProgram) {
    if (decorator) {
      throw new _exception2['default']('Unexpected inverse block on decorator', inverseAndProgram);
    }

    if (inverseAndProgram.chain) {
      inverseAndProgram.program.body[0].closeStrip = close.strip;
    }

    inverseStrip = inverseAndProgram.strip;
    inverse = inverseAndProgram.program;
  }

  if (inverted) {
    inverted = inverse;
    inverse = program;
    program = inverted;
  }

  return {
    type: decorator ? 'DecoratorBlock' : 'BlockStatement',
    path: openBlock.path,
    params: openBlock.params,
    hash: openBlock.hash,
    program: program,
    inverse: inverse,
    openStrip: openBlock.strip,
    inverseStrip: inverseStrip,
    closeStrip: close && close.strip,
    loc: this.locInfo(locInfo)
  };
}

function prepareProgram(statements, loc) {
  if (!loc && statements.length) {
    var firstLoc = statements[0].loc,
        lastLoc = statements[statements.length - 1].loc;

    /* istanbul ignore else */
    if (firstLoc && lastLoc) {
      loc = {
        source: firstLoc.source,
        start: {
          line: firstLoc.start.line,
          column: firstLoc.start.column
        },
        end: {
          line: lastLoc.end.line,
          column: lastLoc.end.column
        }
      };
    }
  }

  return {
    type: 'Program',
    body: statements,
    strip: {},
    loc: loc
  };
}

function preparePartialBlock(open, program, close, locInfo) {
  validateClose(open, close);

  return {
    type: 'PartialBlockStatement',
    name: open.path,
    params: open.params,
    hash: open.hash,
    program: program,
    openStrip: open.strip,
    closeStrip: close && close.strip,
    loc: this.locInfo(locInfo)
  };
}


},{"../exception":18}],11:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('../base');

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

var _utils = require('../utils');

var _codeGen = require('./code-gen');

var _codeGen2 = _interopRequireDefault(_codeGen);

function Literal(value) {
  this.value = value;
}

function JavaScriptCompiler() {}

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function nameLookup(parent, name /* , type*/) {
    if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      return [parent, '.', name];
    } else {
      return [parent, '[', JSON.stringify(name), ']'];
    }
  },
  depthedLookup: function depthedLookup(name) {
    return [this.aliasable('container.lookup'), '(depths, "', name, '")'];
  },

  compilerInfo: function compilerInfo() {
    var revision = _base.COMPILER_REVISION,
        versions = _base.REVISION_CHANGES[revision];
    return [revision, versions];
  },

  appendToBuffer: function appendToBuffer(source, location, explicit) {
    // Force a source as this simplifies the merge logic.
    if (!_utils.isArray(source)) {
      source = [source];
    }
    source = this.source.wrap(source, location);

    if (this.environment.isSimple) {
      return ['return ', source, ';'];
    } else if (explicit) {
      // This is a case where the buffer operation occurs as a child of another
      // construct, generally braces. We have to explicitly output these buffer
      // operations to ensure that the emitted code goes in the correct location.
      return ['buffer += ', source, ';'];
    } else {
      source.appendToBuffer = true;
      return source;
    }
  },

  initializeBuffer: function initializeBuffer() {
    return this.quotedString('');
  },
  // END PUBLIC API

  compile: function compile(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options;
    this.stringParams = this.options.stringParams;
    this.trackIds = this.options.trackIds;
    this.precompile = !asObject;

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      decorators: [],
      programs: [],
      environments: []
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.aliases = {};
    this.registers = { list: [] };
    this.hashes = [];
    this.compileStack = [];
    this.inlineStack = [];
    this.blockParams = [];

    this.compileChildren(environment, options);

    this.useDepths = this.useDepths || environment.useDepths || environment.useDecorators || this.options.compat;
    this.useBlockParams = this.useBlockParams || environment.useBlockParams;

    var opcodes = environment.opcodes,
        opcode = undefined,
        firstLoc = undefined,
        i = undefined,
        l = undefined;

    for (i = 0, l = opcodes.length; i < l; i++) {
      opcode = opcodes[i];

      this.source.currentLocation = opcode.loc;
      firstLoc = firstLoc || opcode.loc;
      this[opcode.opcode].apply(this, opcode.args);
    }

    // Flush any trailing content that might be pending.
    this.source.currentLocation = firstLoc;
    this.pushSource('');

    /* istanbul ignore next */
    if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
      throw new _exception2['default']('Compile completed with content left on stack');
    }

    if (!this.decorators.isEmpty()) {
      this.useDecorators = true;

      this.decorators.prepend('var decorators = container.decorators;\n');
      this.decorators.push('return fn;');

      if (asObject) {
        this.decorators = Function.apply(this, ['fn', 'props', 'container', 'depth0', 'data', 'blockParams', 'depths', this.decorators.merge()]);
      } else {
        this.decorators.prepend('function(fn, props, container, depth0, data, blockParams, depths) {\n');
        this.decorators.push('}\n');
        this.decorators = this.decorators.merge();
      }
    } else {
      this.decorators = undefined;
    }

    var fn = this.createFunctionContext(asObject);
    if (!this.isChild) {
      var ret = {
        compiler: this.compilerInfo(),
        main: fn
      };

      if (this.decorators) {
        ret.main_d = this.decorators; // eslint-disable-line camelcase
        ret.useDecorators = true;
      }

      var _context = this.context;
      var programs = _context.programs;
      var decorators = _context.decorators;

      for (i = 0, l = programs.length; i < l; i++) {
        if (programs[i]) {
          ret[i] = programs[i];
          if (decorators[i]) {
            ret[i + '_d'] = decorators[i];
            ret.useDecorators = true;
          }
        }
      }

      if (this.environment.usePartial) {
        ret.usePartial = true;
      }
      if (this.options.data) {
        ret.useData = true;
      }
      if (this.useDepths) {
        ret.useDepths = true;
      }
      if (this.useBlockParams) {
        ret.useBlockParams = true;
      }
      if (this.options.compat) {
        ret.compat = true;
      }

      if (!asObject) {
        ret.compiler = JSON.stringify(ret.compiler);

        this.source.currentLocation = { start: { line: 1, column: 0 } };
        ret = this.objectLiteral(ret);

        if (options.srcName) {
          ret = ret.toStringWithSourceMap({ file: options.destName });
          ret.map = ret.map && ret.map.toString();
        } else {
          ret = ret.toString();
        }
      } else {
        ret.compilerOptions = this.options;
      }

      return ret;
    } else {
      return fn;
    }
  },

  preamble: function preamble() {
    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = new _codeGen2['default'](this.options.srcName);
    this.decorators = new _codeGen2['default'](this.options.srcName);
  },

  createFunctionContext: function createFunctionContext(asObject) {
    var varDeclarations = '';

    var locals = this.stackVars.concat(this.registers.list);
    if (locals.length > 0) {
      varDeclarations += ', ' + locals.join(', ');
    }

    // Generate minimizer alias mappings
    //
    // When using true SourceNodes, this will update all references to the given alias
    // as the source nodes are reused in situ. For the non-source node compilation mode,
    // aliases will not be used, but this case is already being run on the client and
    // we aren't concern about minimizing the template size.
    var aliasCount = 0;
    for (var alias in this.aliases) {
      // eslint-disable-line guard-for-in
      var node = this.aliases[alias];

      if (this.aliases.hasOwnProperty(alias) && node.children && node.referenceCount > 1) {
        varDeclarations += ', alias' + ++aliasCount + '=' + alias;
        node.children[0] = 'alias' + aliasCount;
      }
    }

    var params = ['container', 'depth0', 'helpers', 'partials', 'data'];

    if (this.useBlockParams || this.useDepths) {
      params.push('blockParams');
    }
    if (this.useDepths) {
      params.push('depths');
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource(varDeclarations);

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      return this.source.wrap(['function(', params.join(','), ') {\n  ', source, '}']);
    }
  },
  mergeSource: function mergeSource(varDeclarations) {
    var isSimple = this.environment.isSimple,
        appendOnly = !this.forceBuffer,
        appendFirst = undefined,
        sourceSeen = undefined,
        bufferStart = undefined,
        bufferEnd = undefined;
    this.source.each(function (line) {
      if (line.appendToBuffer) {
        if (bufferStart) {
          line.prepend('  + ');
        } else {
          bufferStart = line;
        }
        bufferEnd = line;
      } else {
        if (bufferStart) {
          if (!sourceSeen) {
            appendFirst = true;
          } else {
            bufferStart.prepend('buffer += ');
          }
          bufferEnd.add(';');
          bufferStart = bufferEnd = undefined;
        }

        sourceSeen = true;
        if (!isSimple) {
          appendOnly = false;
        }
      }
    });

    if (appendOnly) {
      if (bufferStart) {
        bufferStart.prepend('return ');
        bufferEnd.add(';');
      } else if (!sourceSeen) {
        this.source.push('return "";');
      }
    } else {
      varDeclarations += ', buffer = ' + (appendFirst ? '' : this.initializeBuffer());

      if (bufferStart) {
        bufferStart.prepend('return buffer + ');
        bufferEnd.add(';');
      } else {
        this.source.push('return buffer;');
      }
    }

    if (varDeclarations) {
      this.source.prepend('var ' + varDeclarations.substring(2) + (appendFirst ? '' : ';\n'));
    }

    return this.source.merge();
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#this.foo}}...{{/this.foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function blockValue(name) {
    var blockHelperMissing = this.aliasable('helpers.blockHelperMissing'),
        params = [this.contextName(0)];
    this.setupHelperArgs(name, 0, params);

    var blockName = this.popStack();
    params.splice(1, 0, blockName);

    this.push(this.source.functionCall(blockHelperMissing, 'call', params));
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function ambiguousBlockValue() {
    // We're being a bit cheeky and reusing the options value from the prior exec
    var blockHelperMissing = this.aliasable('helpers.blockHelperMissing'),
        params = [this.contextName(0)];
    this.setupHelperArgs('', 0, params, true);

    this.flushInline();

    var current = this.topStack();
    params.splice(1, 0, current);

    this.pushSource(['if (!', this.lastHelper, ') { ', current, ' = ', this.source.functionCall(blockHelperMissing, 'call', params), '}']);
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function appendContent(content) {
    if (this.pendingContent) {
      content = this.pendingContent + content;
    } else {
      this.pendingLocation = this.source.currentLocation;
    }

    this.pendingContent = content;
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function append() {
    if (this.isInline()) {
      this.replaceStack(function (current) {
        return [' != null ? ', current, ' : ""'];
      });

      this.pushSource(this.appendToBuffer(this.popStack()));
    } else {
      var local = this.popStack();
      this.pushSource(['if (', local, ' != null) { ', this.appendToBuffer(local, undefined, true), ' }']);
      if (this.environment.isSimple) {
        this.pushSource(['else { ', this.appendToBuffer("''", undefined, true), ' }']);
      }
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function appendEscaped() {
    this.pushSource(this.appendToBuffer([this.aliasable('container.escapeExpression'), '(', this.popStack(), ')']));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function getContext(depth) {
    this.lastContext = depth;
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function pushContext() {
    this.pushStackLiteral(this.contextName(this.lastContext));
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function lookupOnContext(parts, falsy, strict, scoped) {
    var i = 0;

    if (!scoped && this.options.compat && !this.lastContext) {
      // The depthed query is expected to handle the undefined logic for the root level that
      // is implemented below, so we evaluate that directly in compat mode
      this.push(this.depthedLookup(parts[i++]));
    } else {
      this.pushContext();
    }

    this.resolvePath('context', parts, i, falsy, strict);
  },

  // [lookupBlockParam]
  //
  // On stack, before: ...
  // On stack, after: blockParam[name], ...
  //
  // Looks up the value of `parts` on the given block param and pushes
  // it onto the stack.
  lookupBlockParam: function lookupBlockParam(blockParamId, parts) {
    this.useBlockParams = true;

    this.push(['blockParams[', blockParamId[0], '][', blockParamId[1], ']']);
    this.resolvePath('context', parts, 1);
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function lookupData(depth, parts, strict) {
    if (!depth) {
      this.pushStackLiteral('data');
    } else {
      this.pushStackLiteral('container.data(data, ' + depth + ')');
    }

    this.resolvePath('data', parts, 0, true, strict);
  },

  resolvePath: function resolvePath(type, parts, i, falsy, strict) {
    // istanbul ignore next

    var _this = this;

    if (this.options.strict || this.options.assumeObjects) {
      this.push(strictLookup(this.options.strict && strict, this, parts, type));
      return;
    }

    var len = parts.length;
    for (; i < len; i++) {
      /* eslint-disable no-loop-func */
      this.replaceStack(function (current) {
        var lookup = _this.nameLookup(current, parts[i], type);
        // We want to ensure that zero and false are handled properly if the context (falsy flag)
        // needs to have the special handling for these values.
        if (!falsy) {
          return [' != null ? ', lookup, ' : ', current];
        } else {
          // Otherwise we can use generic falsy handling
          return [' && ', lookup];
        }
      });
      /* eslint-enable no-loop-func */
    }
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function resolvePossibleLambda() {
    this.push([this.aliasable('container.lambda'), '(', this.popStack(), ', ', this.contextName(0), ')']);
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function pushStringParam(string, type) {
    this.pushContext();
    this.pushString(type);

    // If it's a subexpression, the string result
    // will be pushed after this opcode.
    if (type !== 'SubExpression') {
      if (typeof string === 'string') {
        this.pushString(string);
      } else {
        this.pushStackLiteral(string);
      }
    }
  },

  emptyHash: function emptyHash(omitEmpty) {
    if (this.trackIds) {
      this.push('{}'); // hashIds
    }
    if (this.stringParams) {
      this.push('{}'); // hashContexts
      this.push('{}'); // hashTypes
    }
    this.pushStackLiteral(omitEmpty ? 'undefined' : '{}');
  },
  pushHash: function pushHash() {
    if (this.hash) {
      this.hashes.push(this.hash);
    }
    this.hash = { values: [], types: [], contexts: [], ids: [] };
  },
  popHash: function popHash() {
    var hash = this.hash;
    this.hash = this.hashes.pop();

    if (this.trackIds) {
      this.push(this.objectLiteral(hash.ids));
    }
    if (this.stringParams) {
      this.push(this.objectLiteral(hash.contexts));
      this.push(this.objectLiteral(hash.types));
    }

    this.push(this.objectLiteral(hash.values));
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function pushString(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function pushLiteral(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function pushProgram(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [registerDecorator]
  //
  // On stack, before: hash, program, params..., ...
  // On stack, after: ...
  //
  // Pops off the decorator's parameters, invokes the decorator,
  // and inserts the decorator into the decorators list.
  registerDecorator: function registerDecorator(paramSize, name) {
    var foundDecorator = this.nameLookup('decorators', name, 'decorator'),
        options = this.setupHelperArgs(name, paramSize);

    this.decorators.push(['fn = ', this.decorators.functionCall(foundDecorator, '', ['fn', 'props', 'container', options]), ' || fn;']);
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function invokeHelper(paramSize, name, isSimple) {
    var nonHelper = this.popStack(),
        helper = this.setupHelper(paramSize, name),
        simple = isSimple ? [helper.name, ' || '] : '';

    var lookup = ['('].concat(simple, nonHelper);
    if (!this.options.strict) {
      lookup.push(' || ', this.aliasable('helpers.helperMissing'));
    }
    lookup.push(')');

    this.push(this.source.functionCall(lookup, 'call', helper.callParams));
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function invokeKnownHelper(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(this.source.functionCall(helper.name, 'call', helper.callParams));
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function invokeAmbiguous(name, helperCall) {
    this.useRegister('helper');

    var nonHelper = this.popStack();

    this.emptyHash();
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    var lookup = ['(', '(helper = ', helperName, ' || ', nonHelper, ')'];
    if (!this.options.strict) {
      lookup[0] = '(helper = ';
      lookup.push(' != null ? helper : ', this.aliasable('helpers.helperMissing'));
    }

    this.push(['(', lookup, helper.paramsInit ? ['),(', helper.paramsInit] : [], '),', '(typeof helper === ', this.aliasable('"function"'), ' ? ', this.source.functionCall('helper', 'call', helper.callParams), ' : helper))']);
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function invokePartial(isDynamic, name, indent) {
    var params = [],
        options = this.setupParams(name, 1, params);

    if (isDynamic) {
      name = this.popStack();
      delete options.name;
    }

    if (indent) {
      options.indent = JSON.stringify(indent);
    }
    options.helpers = 'helpers';
    options.partials = 'partials';
    options.decorators = 'container.decorators';

    if (!isDynamic) {
      params.unshift(this.nameLookup('partials', name, 'partial'));
    } else {
      params.unshift(name);
    }

    if (this.options.compat) {
      options.depths = 'depths';
    }
    options = this.objectLiteral(options);
    params.push(options);

    this.push(this.source.functionCall('container.invokePartial', '', params));
  },

  // [assignToHash]
  //
  // On stack, before: value, ..., hash, ...
  // On stack, after: ..., hash, ...
  //
  // Pops a value off the stack and assigns it to the current hash
  assignToHash: function assignToHash(key) {
    var value = this.popStack(),
        context = undefined,
        type = undefined,
        id = undefined;

    if (this.trackIds) {
      id = this.popStack();
    }
    if (this.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts[key] = context;
    }
    if (type) {
      hash.types[key] = type;
    }
    if (id) {
      hash.ids[key] = id;
    }
    hash.values[key] = value;
  },

  pushId: function pushId(type, name, child) {
    if (type === 'BlockParam') {
      this.pushStackLiteral('blockParams[' + name[0] + '].path[' + name[1] + ']' + (child ? ' + ' + JSON.stringify('.' + child) : ''));
    } else if (type === 'PathExpression') {
      this.pushString(name);
    } else if (type === 'SubExpression') {
      this.pushStackLiteral('true');
    } else {
      this.pushStackLiteral('null');
    }
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function compileChildren(environment, options) {
    var children = environment.children,
        child = undefined,
        compiler = undefined;

    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      compiler = new this.compiler(); // eslint-disable-line new-cap

      var existing = this.matchExistingProgram(child);

      if (existing == null) {
        this.context.programs.push(''); // Placeholder to prevent name conflicts for nested children
        var index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context, !this.precompile);
        this.context.decorators[index] = compiler.decorators;
        this.context.environments[index] = child;

        this.useDepths = this.useDepths || compiler.useDepths;
        this.useBlockParams = this.useBlockParams || compiler.useBlockParams;
        child.useDepths = this.useDepths;
        child.useBlockParams = this.useBlockParams;
      } else {
        child.index = existing.index;
        child.name = 'program' + existing.index;

        this.useDepths = this.useDepths || existing.useDepths;
        this.useBlockParams = this.useBlockParams || existing.useBlockParams;
      }
    }
  },
  matchExistingProgram: function matchExistingProgram(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return environment;
      }
    }
  },

  programExpression: function programExpression(guid) {
    var child = this.environment.children[guid],
        programParams = [child.index, 'data', child.blockParams];

    if (this.useBlockParams || this.useDepths) {
      programParams.push('blockParams');
    }
    if (this.useDepths) {
      programParams.push('depths');
    }

    return 'container.program(' + programParams.join(', ') + ')';
  },

  useRegister: function useRegister(name) {
    if (!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  push: function push(expr) {
    if (!(expr instanceof Literal)) {
      expr = this.source.wrap(expr);
    }

    this.inlineStack.push(expr);
    return expr;
  },

  pushStackLiteral: function pushStackLiteral(item) {
    this.push(new Literal(item));
  },

  pushSource: function pushSource(source) {
    if (this.pendingContent) {
      this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent), this.pendingLocation));
      this.pendingContent = undefined;
    }

    if (source) {
      this.source.push(source);
    }
  },

  replaceStack: function replaceStack(callback) {
    var prefix = ['('],
        stack = undefined,
        createdStack = undefined,
        usedLiteral = undefined;

    /* istanbul ignore next */
    if (!this.isInline()) {
      throw new _exception2['default']('replaceStack on non-inline');
    }

    // We want to merge the inline statement into the replacement statement via ','
    var top = this.popStack(true);

    if (top instanceof Literal) {
      // Literals do not need to be inlined
      stack = [top.value];
      prefix = ['(', stack];
      usedLiteral = true;
    } else {
      // Get or create the current stack name for use by the inline
      createdStack = true;
      var _name = this.incrStack();

      prefix = ['((', this.push(_name), ' = ', top, ')'];
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (!usedLiteral) {
      this.popStack();
    }
    if (createdStack) {
      this.stackSlot--;
    }
    this.push(prefix.concat(item, ')'));
  },

  incrStack: function incrStack() {
    this.stackSlot++;
    if (this.stackSlot > this.stackVars.length) {
      this.stackVars.push('stack' + this.stackSlot);
    }
    return this.topStackName();
  },
  topStackName: function topStackName() {
    return 'stack' + this.stackSlot;
  },
  flushInline: function flushInline() {
    var inlineStack = this.inlineStack;
    this.inlineStack = [];
    for (var i = 0, len = inlineStack.length; i < len; i++) {
      var entry = inlineStack[i];
      /* istanbul ignore if */
      if (entry instanceof Literal) {
        this.compileStack.push(entry);
      } else {
        var stack = this.incrStack();
        this.pushSource([stack, ' = ', entry, ';']);
        this.compileStack.push(stack);
      }
    }
  },
  isInline: function isInline() {
    return this.inlineStack.length;
  },

  popStack: function popStack(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && item instanceof Literal) {
      return item.value;
    } else {
      if (!inline) {
        /* istanbul ignore next */
        if (!this.stackSlot) {
          throw new _exception2['default']('Invalid stack pop');
        }
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function topStack() {
    var stack = this.isInline() ? this.inlineStack : this.compileStack,
        item = stack[stack.length - 1];

    /* istanbul ignore if */
    if (item instanceof Literal) {
      return item.value;
    } else {
      return item;
    }
  },

  contextName: function contextName(context) {
    if (this.useDepths && context) {
      return 'depths[' + context + ']';
    } else {
      return 'depth' + context;
    }
  },

  quotedString: function quotedString(str) {
    return this.source.quotedString(str);
  },

  objectLiteral: function objectLiteral(obj) {
    return this.source.objectLiteral(obj);
  },

  aliasable: function aliasable(name) {
    var ret = this.aliases[name];
    if (ret) {
      ret.referenceCount++;
      return ret;
    }

    ret = this.aliases[name] = this.source.wrap(name);
    ret.aliasable = true;
    ret.referenceCount = 1;

    return ret;
  },

  setupHelper: function setupHelper(paramSize, name, blockHelper) {
    var params = [],
        paramsInit = this.setupHelperArgs(name, paramSize, params, blockHelper);
    var foundHelper = this.nameLookup('helpers', name, 'helper'),
        callContext = this.aliasable(this.contextName(0) + ' != null ? ' + this.contextName(0) + ' : (container.nullContext || {})');

    return {
      params: params,
      paramsInit: paramsInit,
      name: foundHelper,
      callParams: [callContext].concat(params)
    };
  },

  setupParams: function setupParams(helper, paramSize, params) {
    var options = {},
        contexts = [],
        types = [],
        ids = [],
        objectArgs = !params,
        param = undefined;

    if (objectArgs) {
      params = [];
    }

    options.name = this.quotedString(helper);
    options.hash = this.popStack();

    if (this.trackIds) {
      options.hashIds = this.popStack();
    }
    if (this.stringParams) {
      options.hashTypes = this.popStack();
      options.hashContexts = this.popStack();
    }

    var inverse = this.popStack(),
        program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      options.fn = program || 'container.noop';
      options.inverse = inverse || 'container.noop';
    }

    // The parameters go on to the stack in order (making sure that they are evaluated in order)
    // so we need to pop them off the stack in reverse order
    var i = paramSize;
    while (i--) {
      param = this.popStack();
      params[i] = param;

      if (this.trackIds) {
        ids[i] = this.popStack();
      }
      if (this.stringParams) {
        types[i] = this.popStack();
        contexts[i] = this.popStack();
      }
    }

    if (objectArgs) {
      options.args = this.source.generateArray(params);
    }

    if (this.trackIds) {
      options.ids = this.source.generateArray(ids);
    }
    if (this.stringParams) {
      options.types = this.source.generateArray(types);
      options.contexts = this.source.generateArray(contexts);
    }

    if (this.options.data) {
      options.data = 'data';
    }
    if (this.useBlockParams) {
      options.blockParams = 'blockParams';
    }
    return options;
  },

  setupHelperArgs: function setupHelperArgs(helper, paramSize, params, useRegister) {
    var options = this.setupParams(helper, paramSize, params);
    options = this.objectLiteral(options);
    if (useRegister) {
      this.useRegister('options');
      params.push('options');
      return ['options=', options];
    } else if (params) {
      params.push(options);
      return '';
    } else {
      return options;
    }
  }
};

(function () {
  var reservedWords = ('break else new var' + ' case finally return void' + ' catch for switch while' + ' continue function this with' + ' default if throw' + ' delete in try' + ' do instanceof typeof' + ' abstract enum int short' + ' boolean export interface static' + ' byte extends long super' + ' char final native synchronized' + ' class float package throws' + ' const goto private transient' + ' debugger implements protected volatile' + ' double import public let yield await' + ' null true false').split(' ');

  var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

  for (var i = 0, l = reservedWords.length; i < l; i++) {
    compilerWords[reservedWords[i]] = true;
  }
})();

JavaScriptCompiler.isValidJavaScriptVariableName = function (name) {
  return !JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
};

function strictLookup(requireTerminal, compiler, parts, type) {
  var stack = compiler.popStack(),
      i = 0,
      len = parts.length;
  if (requireTerminal) {
    len--;
  }

  for (; i < len; i++) {
    stack = compiler.nameLookup(stack, parts[i], type);
  }

  if (requireTerminal) {
    return [compiler.aliasable('container.strict'), '(', stack, ', ', compiler.quotedString(parts[i]), ')'];
  } else {
    return stack;
  }
}

exports['default'] = JavaScriptCompiler;
module.exports = exports['default'];


},{"../base":5,"../exception":18,"../utils":31,"./code-gen":8}],12:[function(require,module,exports){
// File ignored in coverage tests via setting in .istanbul.yml
/* Jison generated parser */
"use strict";

exports.__esModule = true;
var handlebars = (function () {
    var parser = { trace: function trace() {},
        yy: {},
        symbols_: { "error": 2, "root": 3, "program": 4, "EOF": 5, "program_repetition0": 6, "statement": 7, "mustache": 8, "block": 9, "rawBlock": 10, "partial": 11, "partialBlock": 12, "content": 13, "COMMENT": 14, "CONTENT": 15, "openRawBlock": 16, "rawBlock_repetition_plus0": 17, "END_RAW_BLOCK": 18, "OPEN_RAW_BLOCK": 19, "helperName": 20, "openRawBlock_repetition0": 21, "openRawBlock_option0": 22, "CLOSE_RAW_BLOCK": 23, "openBlock": 24, "block_option0": 25, "closeBlock": 26, "openInverse": 27, "block_option1": 28, "OPEN_BLOCK": 29, "openBlock_repetition0": 30, "openBlock_option0": 31, "openBlock_option1": 32, "CLOSE": 33, "OPEN_INVERSE": 34, "openInverse_repetition0": 35, "openInverse_option0": 36, "openInverse_option1": 37, "openInverseChain": 38, "OPEN_INVERSE_CHAIN": 39, "openInverseChain_repetition0": 40, "openInverseChain_option0": 41, "openInverseChain_option1": 42, "inverseAndProgram": 43, "INVERSE": 44, "inverseChain": 45, "inverseChain_option0": 46, "OPEN_ENDBLOCK": 47, "OPEN": 48, "mustache_repetition0": 49, "mustache_option0": 50, "OPEN_UNESCAPED": 51, "mustache_repetition1": 52, "mustache_option1": 53, "CLOSE_UNESCAPED": 54, "OPEN_PARTIAL": 55, "partialName": 56, "partial_repetition0": 57, "partial_option0": 58, "openPartialBlock": 59, "OPEN_PARTIAL_BLOCK": 60, "openPartialBlock_repetition0": 61, "openPartialBlock_option0": 62, "param": 63, "sexpr": 64, "OPEN_SEXPR": 65, "sexpr_repetition0": 66, "sexpr_option0": 67, "CLOSE_SEXPR": 68, "hash": 69, "hash_repetition_plus0": 70, "hashSegment": 71, "ID": 72, "EQUALS": 73, "blockParams": 74, "OPEN_BLOCK_PARAMS": 75, "blockParams_repetition_plus0": 76, "CLOSE_BLOCK_PARAMS": 77, "path": 78, "dataName": 79, "STRING": 80, "NUMBER": 81, "BOOLEAN": 82, "UNDEFINED": 83, "NULL": 84, "DATA": 85, "pathSegments": 86, "SEP": 87, "$accept": 0, "$end": 1 },
        terminals_: { 2: "error", 5: "EOF", 14: "COMMENT", 15: "CONTENT", 18: "END_RAW_BLOCK", 19: "OPEN_RAW_BLOCK", 23: "CLOSE_RAW_BLOCK", 29: "OPEN_BLOCK", 33: "CLOSE", 34: "OPEN_INVERSE", 39: "OPEN_INVERSE_CHAIN", 44: "INVERSE", 47: "OPEN_ENDBLOCK", 48: "OPEN", 51: "OPEN_UNESCAPED", 54: "CLOSE_UNESCAPED", 55: "OPEN_PARTIAL", 60: "OPEN_PARTIAL_BLOCK", 65: "OPEN_SEXPR", 68: "CLOSE_SEXPR", 72: "ID", 73: "EQUALS", 75: "OPEN_BLOCK_PARAMS", 77: "CLOSE_BLOCK_PARAMS", 80: "STRING", 81: "NUMBER", 82: "BOOLEAN", 83: "UNDEFINED", 84: "NULL", 85: "DATA", 87: "SEP" },
        productions_: [0, [3, 2], [4, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [13, 1], [10, 3], [16, 5], [9, 4], [9, 4], [24, 6], [27, 6], [38, 6], [43, 2], [45, 3], [45, 1], [26, 3], [8, 5], [8, 5], [11, 5], [12, 3], [59, 5], [63, 1], [63, 1], [64, 5], [69, 1], [71, 3], [74, 3], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [56, 1], [56, 1], [79, 2], [78, 1], [86, 3], [86, 1], [6, 0], [6, 2], [17, 1], [17, 2], [21, 0], [21, 2], [22, 0], [22, 1], [25, 0], [25, 1], [28, 0], [28, 1], [30, 0], [30, 2], [31, 0], [31, 1], [32, 0], [32, 1], [35, 0], [35, 2], [36, 0], [36, 1], [37, 0], [37, 1], [40, 0], [40, 2], [41, 0], [41, 1], [42, 0], [42, 1], [46, 0], [46, 1], [49, 0], [49, 2], [50, 0], [50, 1], [52, 0], [52, 2], [53, 0], [53, 1], [57, 0], [57, 2], [58, 0], [58, 1], [61, 0], [61, 2], [62, 0], [62, 1], [66, 0], [66, 2], [67, 0], [67, 1], [70, 1], [70, 2], [76, 1], [76, 2]],
        performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$
        /**/) {

            var $0 = $$.length - 1;
            switch (yystate) {
                case 1:
                    return $$[$0 - 1];
                    break;
                case 2:
                    this.$ = yy.prepareProgram($$[$0]);
                    break;
                case 3:
                    this.$ = $$[$0];
                    break;
                case 4:
                    this.$ = $$[$0];
                    break;
                case 5:
                    this.$ = $$[$0];
                    break;
                case 6:
                    this.$ = $$[$0];
                    break;
                case 7:
                    this.$ = $$[$0];
                    break;
                case 8:
                    this.$ = $$[$0];
                    break;
                case 9:
                    this.$ = {
                        type: 'CommentStatement',
                        value: yy.stripComment($$[$0]),
                        strip: yy.stripFlags($$[$0], $$[$0]),
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 10:
                    this.$ = {
                        type: 'ContentStatement',
                        original: $$[$0],
                        value: $$[$0],
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 11:
                    this.$ = yy.prepareRawBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
                    break;
                case 12:
                    this.$ = { path: $$[$0 - 3], params: $$[$0 - 2], hash: $$[$0 - 1] };
                    break;
                case 13:
                    this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], false, this._$);
                    break;
                case 14:
                    this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], true, this._$);
                    break;
                case 15:
                    this.$ = { open: $$[$0 - 5], path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
                    break;
                case 16:
                    this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
                    break;
                case 17:
                    this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
                    break;
                case 18:
                    this.$ = { strip: yy.stripFlags($$[$0 - 1], $$[$0 - 1]), program: $$[$0] };
                    break;
                case 19:
                    var inverse = yy.prepareBlock($$[$0 - 2], $$[$0 - 1], $$[$0], $$[$0], false, this._$),
                        program = yy.prepareProgram([inverse], $$[$0 - 1].loc);
                    program.chained = true;

                    this.$ = { strip: $$[$0 - 2].strip, program: program, chain: true };

                    break;
                case 20:
                    this.$ = $$[$0];
                    break;
                case 21:
                    this.$ = { path: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 2], $$[$0]) };
                    break;
                case 22:
                    this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
                    break;
                case 23:
                    this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
                    break;
                case 24:
                    this.$ = {
                        type: 'PartialStatement',
                        name: $$[$0 - 3],
                        params: $$[$0 - 2],
                        hash: $$[$0 - 1],
                        indent: '',
                        strip: yy.stripFlags($$[$0 - 4], $$[$0]),
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 25:
                    this.$ = yy.preparePartialBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
                    break;
                case 26:
                    this.$ = { path: $$[$0 - 3], params: $$[$0 - 2], hash: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 4], $$[$0]) };
                    break;
                case 27:
                    this.$ = $$[$0];
                    break;
                case 28:
                    this.$ = $$[$0];
                    break;
                case 29:
                    this.$ = {
                        type: 'SubExpression',
                        path: $$[$0 - 3],
                        params: $$[$0 - 2],
                        hash: $$[$0 - 1],
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 30:
                    this.$ = { type: 'Hash', pairs: $$[$0], loc: yy.locInfo(this._$) };
                    break;
                case 31:
                    this.$ = { type: 'HashPair', key: yy.id($$[$0 - 2]), value: $$[$0], loc: yy.locInfo(this._$) };
                    break;
                case 32:
                    this.$ = yy.id($$[$0 - 1]);
                    break;
                case 33:
                    this.$ = $$[$0];
                    break;
                case 34:
                    this.$ = $$[$0];
                    break;
                case 35:
                    this.$ = { type: 'StringLiteral', value: $$[$0], original: $$[$0], loc: yy.locInfo(this._$) };
                    break;
                case 36:
                    this.$ = { type: 'NumberLiteral', value: Number($$[$0]), original: Number($$[$0]), loc: yy.locInfo(this._$) };
                    break;
                case 37:
                    this.$ = { type: 'BooleanLiteral', value: $$[$0] === 'true', original: $$[$0] === 'true', loc: yy.locInfo(this._$) };
                    break;
                case 38:
                    this.$ = { type: 'UndefinedLiteral', original: undefined, value: undefined, loc: yy.locInfo(this._$) };
                    break;
                case 39:
                    this.$ = { type: 'NullLiteral', original: null, value: null, loc: yy.locInfo(this._$) };
                    break;
                case 40:
                    this.$ = $$[$0];
                    break;
                case 41:
                    this.$ = $$[$0];
                    break;
                case 42:
                    this.$ = yy.preparePath(true, $$[$0], this._$);
                    break;
                case 43:
                    this.$ = yy.preparePath(false, $$[$0], this._$);
                    break;
                case 44:
                    $$[$0 - 2].push({ part: yy.id($$[$0]), original: $$[$0], separator: $$[$0 - 1] });this.$ = $$[$0 - 2];
                    break;
                case 45:
                    this.$ = [{ part: yy.id($$[$0]), original: $$[$0] }];
                    break;
                case 46:
                    this.$ = [];
                    break;
                case 47:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 48:
                    this.$ = [$$[$0]];
                    break;
                case 49:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 50:
                    this.$ = [];
                    break;
                case 51:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 58:
                    this.$ = [];
                    break;
                case 59:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 64:
                    this.$ = [];
                    break;
                case 65:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 70:
                    this.$ = [];
                    break;
                case 71:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 78:
                    this.$ = [];
                    break;
                case 79:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 82:
                    this.$ = [];
                    break;
                case 83:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 86:
                    this.$ = [];
                    break;
                case 87:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 90:
                    this.$ = [];
                    break;
                case 91:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 94:
                    this.$ = [];
                    break;
                case 95:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 98:
                    this.$ = [$$[$0]];
                    break;
                case 99:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 100:
                    this.$ = [$$[$0]];
                    break;
                case 101:
                    $$[$0 - 1].push($$[$0]);
                    break;
            }
        },
        table: [{ 3: 1, 4: 2, 5: [2, 46], 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 1: [3] }, { 5: [1, 4] }, { 5: [2, 2], 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: [1, 12], 15: [1, 20], 16: 17, 19: [1, 23], 24: 15, 27: 16, 29: [1, 21], 34: [1, 22], 39: [2, 2], 44: [2, 2], 47: [2, 2], 48: [1, 13], 51: [1, 14], 55: [1, 18], 59: 19, 60: [1, 24] }, { 1: [2, 1] }, { 5: [2, 47], 14: [2, 47], 15: [2, 47], 19: [2, 47], 29: [2, 47], 34: [2, 47], 39: [2, 47], 44: [2, 47], 47: [2, 47], 48: [2, 47], 51: [2, 47], 55: [2, 47], 60: [2, 47] }, { 5: [2, 3], 14: [2, 3], 15: [2, 3], 19: [2, 3], 29: [2, 3], 34: [2, 3], 39: [2, 3], 44: [2, 3], 47: [2, 3], 48: [2, 3], 51: [2, 3], 55: [2, 3], 60: [2, 3] }, { 5: [2, 4], 14: [2, 4], 15: [2, 4], 19: [2, 4], 29: [2, 4], 34: [2, 4], 39: [2, 4], 44: [2, 4], 47: [2, 4], 48: [2, 4], 51: [2, 4], 55: [2, 4], 60: [2, 4] }, { 5: [2, 5], 14: [2, 5], 15: [2, 5], 19: [2, 5], 29: [2, 5], 34: [2, 5], 39: [2, 5], 44: [2, 5], 47: [2, 5], 48: [2, 5], 51: [2, 5], 55: [2, 5], 60: [2, 5] }, { 5: [2, 6], 14: [2, 6], 15: [2, 6], 19: [2, 6], 29: [2, 6], 34: [2, 6], 39: [2, 6], 44: [2, 6], 47: [2, 6], 48: [2, 6], 51: [2, 6], 55: [2, 6], 60: [2, 6] }, { 5: [2, 7], 14: [2, 7], 15: [2, 7], 19: [2, 7], 29: [2, 7], 34: [2, 7], 39: [2, 7], 44: [2, 7], 47: [2, 7], 48: [2, 7], 51: [2, 7], 55: [2, 7], 60: [2, 7] }, { 5: [2, 8], 14: [2, 8], 15: [2, 8], 19: [2, 8], 29: [2, 8], 34: [2, 8], 39: [2, 8], 44: [2, 8], 47: [2, 8], 48: [2, 8], 51: [2, 8], 55: [2, 8], 60: [2, 8] }, { 5: [2, 9], 14: [2, 9], 15: [2, 9], 19: [2, 9], 29: [2, 9], 34: [2, 9], 39: [2, 9], 44: [2, 9], 47: [2, 9], 48: [2, 9], 51: [2, 9], 55: [2, 9], 60: [2, 9] }, { 20: 25, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 36, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 37, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 4: 38, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 13: 40, 15: [1, 20], 17: 39 }, { 20: 42, 56: 41, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 45, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 5: [2, 10], 14: [2, 10], 15: [2, 10], 18: [2, 10], 19: [2, 10], 29: [2, 10], 34: [2, 10], 39: [2, 10], 44: [2, 10], 47: [2, 10], 48: [2, 10], 51: [2, 10], 55: [2, 10], 60: [2, 10] }, { 20: 46, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 47, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 48, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 42, 56: 49, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [2, 78], 49: 50, 65: [2, 78], 72: [2, 78], 80: [2, 78], 81: [2, 78], 82: [2, 78], 83: [2, 78], 84: [2, 78], 85: [2, 78] }, { 23: [2, 33], 33: [2, 33], 54: [2, 33], 65: [2, 33], 68: [2, 33], 72: [2, 33], 75: [2, 33], 80: [2, 33], 81: [2, 33], 82: [2, 33], 83: [2, 33], 84: [2, 33], 85: [2, 33] }, { 23: [2, 34], 33: [2, 34], 54: [2, 34], 65: [2, 34], 68: [2, 34], 72: [2, 34], 75: [2, 34], 80: [2, 34], 81: [2, 34], 82: [2, 34], 83: [2, 34], 84: [2, 34], 85: [2, 34] }, { 23: [2, 35], 33: [2, 35], 54: [2, 35], 65: [2, 35], 68: [2, 35], 72: [2, 35], 75: [2, 35], 80: [2, 35], 81: [2, 35], 82: [2, 35], 83: [2, 35], 84: [2, 35], 85: [2, 35] }, { 23: [2, 36], 33: [2, 36], 54: [2, 36], 65: [2, 36], 68: [2, 36], 72: [2, 36], 75: [2, 36], 80: [2, 36], 81: [2, 36], 82: [2, 36], 83: [2, 36], 84: [2, 36], 85: [2, 36] }, { 23: [2, 37], 33: [2, 37], 54: [2, 37], 65: [2, 37], 68: [2, 37], 72: [2, 37], 75: [2, 37], 80: [2, 37], 81: [2, 37], 82: [2, 37], 83: [2, 37], 84: [2, 37], 85: [2, 37] }, { 23: [2, 38], 33: [2, 38], 54: [2, 38], 65: [2, 38], 68: [2, 38], 72: [2, 38], 75: [2, 38], 80: [2, 38], 81: [2, 38], 82: [2, 38], 83: [2, 38], 84: [2, 38], 85: [2, 38] }, { 23: [2, 39], 33: [2, 39], 54: [2, 39], 65: [2, 39], 68: [2, 39], 72: [2, 39], 75: [2, 39], 80: [2, 39], 81: [2, 39], 82: [2, 39], 83: [2, 39], 84: [2, 39], 85: [2, 39] }, { 23: [2, 43], 33: [2, 43], 54: [2, 43], 65: [2, 43], 68: [2, 43], 72: [2, 43], 75: [2, 43], 80: [2, 43], 81: [2, 43], 82: [2, 43], 83: [2, 43], 84: [2, 43], 85: [2, 43], 87: [1, 51] }, { 72: [1, 35], 86: 52 }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 52: 53, 54: [2, 82], 65: [2, 82], 72: [2, 82], 80: [2, 82], 81: [2, 82], 82: [2, 82], 83: [2, 82], 84: [2, 82], 85: [2, 82] }, { 25: 54, 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 55, 47: [2, 54] }, { 28: 60, 43: 61, 44: [1, 59], 47: [2, 56] }, { 13: 63, 15: [1, 20], 18: [1, 62] }, { 15: [2, 48], 18: [2, 48] }, { 33: [2, 86], 57: 64, 65: [2, 86], 72: [2, 86], 80: [2, 86], 81: [2, 86], 82: [2, 86], 83: [2, 86], 84: [2, 86], 85: [2, 86] }, { 33: [2, 40], 65: [2, 40], 72: [2, 40], 80: [2, 40], 81: [2, 40], 82: [2, 40], 83: [2, 40], 84: [2, 40], 85: [2, 40] }, { 33: [2, 41], 65: [2, 41], 72: [2, 41], 80: [2, 41], 81: [2, 41], 82: [2, 41], 83: [2, 41], 84: [2, 41], 85: [2, 41] }, { 20: 65, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 66, 47: [1, 67] }, { 30: 68, 33: [2, 58], 65: [2, 58], 72: [2, 58], 75: [2, 58], 80: [2, 58], 81: [2, 58], 82: [2, 58], 83: [2, 58], 84: [2, 58], 85: [2, 58] }, { 33: [2, 64], 35: 69, 65: [2, 64], 72: [2, 64], 75: [2, 64], 80: [2, 64], 81: [2, 64], 82: [2, 64], 83: [2, 64], 84: [2, 64], 85: [2, 64] }, { 21: 70, 23: [2, 50], 65: [2, 50], 72: [2, 50], 80: [2, 50], 81: [2, 50], 82: [2, 50], 83: [2, 50], 84: [2, 50], 85: [2, 50] }, { 33: [2, 90], 61: 71, 65: [2, 90], 72: [2, 90], 80: [2, 90], 81: [2, 90], 82: [2, 90], 83: [2, 90], 84: [2, 90], 85: [2, 90] }, { 20: 75, 33: [2, 80], 50: 72, 63: 73, 64: 76, 65: [1, 44], 69: 74, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 72: [1, 80] }, { 23: [2, 42], 33: [2, 42], 54: [2, 42], 65: [2, 42], 68: [2, 42], 72: [2, 42], 75: [2, 42], 80: [2, 42], 81: [2, 42], 82: [2, 42], 83: [2, 42], 84: [2, 42], 85: [2, 42], 87: [1, 51] }, { 20: 75, 53: 81, 54: [2, 84], 63: 82, 64: 76, 65: [1, 44], 69: 83, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 84, 47: [1, 67] }, { 47: [2, 55] }, { 4: 85, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 47: [2, 20] }, { 20: 86, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 87, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 26: 88, 47: [1, 67] }, { 47: [2, 57] }, { 5: [2, 11], 14: [2, 11], 15: [2, 11], 19: [2, 11], 29: [2, 11], 34: [2, 11], 39: [2, 11], 44: [2, 11], 47: [2, 11], 48: [2, 11], 51: [2, 11], 55: [2, 11], 60: [2, 11] }, { 15: [2, 49], 18: [2, 49] }, { 20: 75, 33: [2, 88], 58: 89, 63: 90, 64: 76, 65: [1, 44], 69: 91, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 65: [2, 94], 66: 92, 68: [2, 94], 72: [2, 94], 80: [2, 94], 81: [2, 94], 82: [2, 94], 83: [2, 94], 84: [2, 94], 85: [2, 94] }, { 5: [2, 25], 14: [2, 25], 15: [2, 25], 19: [2, 25], 29: [2, 25], 34: [2, 25], 39: [2, 25], 44: [2, 25], 47: [2, 25], 48: [2, 25], 51: [2, 25], 55: [2, 25], 60: [2, 25] }, { 20: 93, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 31: 94, 33: [2, 60], 63: 95, 64: 76, 65: [1, 44], 69: 96, 70: 77, 71: 78, 72: [1, 79], 75: [2, 60], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 66], 36: 97, 63: 98, 64: 76, 65: [1, 44], 69: 99, 70: 77, 71: 78, 72: [1, 79], 75: [2, 66], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 22: 100, 23: [2, 52], 63: 101, 64: 76, 65: [1, 44], 69: 102, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 92], 62: 103, 63: 104, 64: 76, 65: [1, 44], 69: 105, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 106] }, { 33: [2, 79], 65: [2, 79], 72: [2, 79], 80: [2, 79], 81: [2, 79], 82: [2, 79], 83: [2, 79], 84: [2, 79], 85: [2, 79] }, { 33: [2, 81] }, { 23: [2, 27], 33: [2, 27], 54: [2, 27], 65: [2, 27], 68: [2, 27], 72: [2, 27], 75: [2, 27], 80: [2, 27], 81: [2, 27], 82: [2, 27], 83: [2, 27], 84: [2, 27], 85: [2, 27] }, { 23: [2, 28], 33: [2, 28], 54: [2, 28], 65: [2, 28], 68: [2, 28], 72: [2, 28], 75: [2, 28], 80: [2, 28], 81: [2, 28], 82: [2, 28], 83: [2, 28], 84: [2, 28], 85: [2, 28] }, { 23: [2, 30], 33: [2, 30], 54: [2, 30], 68: [2, 30], 71: 107, 72: [1, 108], 75: [2, 30] }, { 23: [2, 98], 33: [2, 98], 54: [2, 98], 68: [2, 98], 72: [2, 98], 75: [2, 98] }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 73: [1, 109], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 23: [2, 44], 33: [2, 44], 54: [2, 44], 65: [2, 44], 68: [2, 44], 72: [2, 44], 75: [2, 44], 80: [2, 44], 81: [2, 44], 82: [2, 44], 83: [2, 44], 84: [2, 44], 85: [2, 44], 87: [2, 44] }, { 54: [1, 110] }, { 54: [2, 83], 65: [2, 83], 72: [2, 83], 80: [2, 83], 81: [2, 83], 82: [2, 83], 83: [2, 83], 84: [2, 83], 85: [2, 83] }, { 54: [2, 85] }, { 5: [2, 13], 14: [2, 13], 15: [2, 13], 19: [2, 13], 29: [2, 13], 34: [2, 13], 39: [2, 13], 44: [2, 13], 47: [2, 13], 48: [2, 13], 51: [2, 13], 55: [2, 13], 60: [2, 13] }, { 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 112, 46: 111, 47: [2, 76] }, { 33: [2, 70], 40: 113, 65: [2, 70], 72: [2, 70], 75: [2, 70], 80: [2, 70], 81: [2, 70], 82: [2, 70], 83: [2, 70], 84: [2, 70], 85: [2, 70] }, { 47: [2, 18] }, { 5: [2, 14], 14: [2, 14], 15: [2, 14], 19: [2, 14], 29: [2, 14], 34: [2, 14], 39: [2, 14], 44: [2, 14], 47: [2, 14], 48: [2, 14], 51: [2, 14], 55: [2, 14], 60: [2, 14] }, { 33: [1, 114] }, { 33: [2, 87], 65: [2, 87], 72: [2, 87], 80: [2, 87], 81: [2, 87], 82: [2, 87], 83: [2, 87], 84: [2, 87], 85: [2, 87] }, { 33: [2, 89] }, { 20: 75, 63: 116, 64: 76, 65: [1, 44], 67: 115, 68: [2, 96], 69: 117, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 118] }, { 32: 119, 33: [2, 62], 74: 120, 75: [1, 121] }, { 33: [2, 59], 65: [2, 59], 72: [2, 59], 75: [2, 59], 80: [2, 59], 81: [2, 59], 82: [2, 59], 83: [2, 59], 84: [2, 59], 85: [2, 59] }, { 33: [2, 61], 75: [2, 61] }, { 33: [2, 68], 37: 122, 74: 123, 75: [1, 121] }, { 33: [2, 65], 65: [2, 65], 72: [2, 65], 75: [2, 65], 80: [2, 65], 81: [2, 65], 82: [2, 65], 83: [2, 65], 84: [2, 65], 85: [2, 65] }, { 33: [2, 67], 75: [2, 67] }, { 23: [1, 124] }, { 23: [2, 51], 65: [2, 51], 72: [2, 51], 80: [2, 51], 81: [2, 51], 82: [2, 51], 83: [2, 51], 84: [2, 51], 85: [2, 51] }, { 23: [2, 53] }, { 33: [1, 125] }, { 33: [2, 91], 65: [2, 91], 72: [2, 91], 80: [2, 91], 81: [2, 91], 82: [2, 91], 83: [2, 91], 84: [2, 91], 85: [2, 91] }, { 33: [2, 93] }, { 5: [2, 22], 14: [2, 22], 15: [2, 22], 19: [2, 22], 29: [2, 22], 34: [2, 22], 39: [2, 22], 44: [2, 22], 47: [2, 22], 48: [2, 22], 51: [2, 22], 55: [2, 22], 60: [2, 22] }, { 23: [2, 99], 33: [2, 99], 54: [2, 99], 68: [2, 99], 72: [2, 99], 75: [2, 99] }, { 73: [1, 109] }, { 20: 75, 63: 126, 64: 76, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 23], 14: [2, 23], 15: [2, 23], 19: [2, 23], 29: [2, 23], 34: [2, 23], 39: [2, 23], 44: [2, 23], 47: [2, 23], 48: [2, 23], 51: [2, 23], 55: [2, 23], 60: [2, 23] }, { 47: [2, 19] }, { 47: [2, 77] }, { 20: 75, 33: [2, 72], 41: 127, 63: 128, 64: 76, 65: [1, 44], 69: 129, 70: 77, 71: 78, 72: [1, 79], 75: [2, 72], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 24], 14: [2, 24], 15: [2, 24], 19: [2, 24], 29: [2, 24], 34: [2, 24], 39: [2, 24], 44: [2, 24], 47: [2, 24], 48: [2, 24], 51: [2, 24], 55: [2, 24], 60: [2, 24] }, { 68: [1, 130] }, { 65: [2, 95], 68: [2, 95], 72: [2, 95], 80: [2, 95], 81: [2, 95], 82: [2, 95], 83: [2, 95], 84: [2, 95], 85: [2, 95] }, { 68: [2, 97] }, { 5: [2, 21], 14: [2, 21], 15: [2, 21], 19: [2, 21], 29: [2, 21], 34: [2, 21], 39: [2, 21], 44: [2, 21], 47: [2, 21], 48: [2, 21], 51: [2, 21], 55: [2, 21], 60: [2, 21] }, { 33: [1, 131] }, { 33: [2, 63] }, { 72: [1, 133], 76: 132 }, { 33: [1, 134] }, { 33: [2, 69] }, { 15: [2, 12] }, { 14: [2, 26], 15: [2, 26], 19: [2, 26], 29: [2, 26], 34: [2, 26], 47: [2, 26], 48: [2, 26], 51: [2, 26], 55: [2, 26], 60: [2, 26] }, { 23: [2, 31], 33: [2, 31], 54: [2, 31], 68: [2, 31], 72: [2, 31], 75: [2, 31] }, { 33: [2, 74], 42: 135, 74: 136, 75: [1, 121] }, { 33: [2, 71], 65: [2, 71], 72: [2, 71], 75: [2, 71], 80: [2, 71], 81: [2, 71], 82: [2, 71], 83: [2, 71], 84: [2, 71], 85: [2, 71] }, { 33: [2, 73], 75: [2, 73] }, { 23: [2, 29], 33: [2, 29], 54: [2, 29], 65: [2, 29], 68: [2, 29], 72: [2, 29], 75: [2, 29], 80: [2, 29], 81: [2, 29], 82: [2, 29], 83: [2, 29], 84: [2, 29], 85: [2, 29] }, { 14: [2, 15], 15: [2, 15], 19: [2, 15], 29: [2, 15], 34: [2, 15], 39: [2, 15], 44: [2, 15], 47: [2, 15], 48: [2, 15], 51: [2, 15], 55: [2, 15], 60: [2, 15] }, { 72: [1, 138], 77: [1, 137] }, { 72: [2, 100], 77: [2, 100] }, { 14: [2, 16], 15: [2, 16], 19: [2, 16], 29: [2, 16], 34: [2, 16], 44: [2, 16], 47: [2, 16], 48: [2, 16], 51: [2, 16], 55: [2, 16], 60: [2, 16] }, { 33: [1, 139] }, { 33: [2, 75] }, { 33: [2, 32] }, { 72: [2, 101], 77: [2, 101] }, { 14: [2, 17], 15: [2, 17], 19: [2, 17], 29: [2, 17], 34: [2, 17], 39: [2, 17], 44: [2, 17], 47: [2, 17], 48: [2, 17], 51: [2, 17], 55: [2, 17], 60: [2, 17] }],
        defaultActions: { 4: [2, 1], 55: [2, 55], 57: [2, 20], 61: [2, 57], 74: [2, 81], 83: [2, 85], 87: [2, 18], 91: [2, 89], 102: [2, 53], 105: [2, 93], 111: [2, 19], 112: [2, 77], 117: [2, 97], 120: [2, 63], 123: [2, 69], 124: [2, 12], 136: [2, 75], 137: [2, 32] },
        parseError: function parseError(str, hash) {
            throw new Error(str);
        },
        parse: function parse(input) {
            var self = this,
                stack = [0],
                vstack = [null],
                lstack = [],
                table = this.table,
                yytext = "",
                yylineno = 0,
                yyleng = 0,
                recovering = 0,
                TERROR = 2,
                EOF = 1;
            this.lexer.setInput(input);
            this.lexer.yy = this.yy;
            this.yy.lexer = this.lexer;
            this.yy.parser = this;
            if (typeof this.lexer.yylloc == "undefined") this.lexer.yylloc = {};
            var yyloc = this.lexer.yylloc;
            lstack.push(yyloc);
            var ranges = this.lexer.options && this.lexer.options.ranges;
            if (typeof this.yy.parseError === "function") this.parseError = this.yy.parseError;
            function popStack(n) {
                stack.length = stack.length - 2 * n;
                vstack.length = vstack.length - n;
                lstack.length = lstack.length - n;
            }
            function lex() {
                var token;
                token = self.lexer.lex() || 1;
                if (typeof token !== "number") {
                    token = self.symbols_[token] || token;
                }
                return token;
            }
            var symbol,
                preErrorSymbol,
                state,
                action,
                a,
                r,
                yyval = {},
                p,
                len,
                newState,
                expected;
            while (true) {
                state = stack[stack.length - 1];
                if (this.defaultActions[state]) {
                    action = this.defaultActions[state];
                } else {
                    if (symbol === null || typeof symbol == "undefined") {
                        symbol = lex();
                    }
                    action = table[state] && table[state][symbol];
                }
                if (typeof action === "undefined" || !action.length || !action[0]) {
                    var errStr = "";
                    if (!recovering) {
                        expected = [];
                        for (p in table[state]) if (this.terminals_[p] && p > 2) {
                            expected.push("'" + this.terminals_[p] + "'");
                        }
                        if (this.lexer.showPosition) {
                            errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                        } else {
                            errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1 ? "end of input" : "'" + (this.terminals_[symbol] || symbol) + "'");
                        }
                        this.parseError(errStr, { text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected });
                    }
                }
                if (action[0] instanceof Array && action.length > 1) {
                    throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
                }
                switch (action[0]) {
                    case 1:
                        stack.push(symbol);
                        vstack.push(this.lexer.yytext);
                        lstack.push(this.lexer.yylloc);
                        stack.push(action[1]);
                        symbol = null;
                        if (!preErrorSymbol) {
                            yyleng = this.lexer.yyleng;
                            yytext = this.lexer.yytext;
                            yylineno = this.lexer.yylineno;
                            yyloc = this.lexer.yylloc;
                            if (recovering > 0) recovering--;
                        } else {
                            symbol = preErrorSymbol;
                            preErrorSymbol = null;
                        }
                        break;
                    case 2:
                        len = this.productions_[action[1]][1];
                        yyval.$ = vstack[vstack.length - len];
                        yyval._$ = { first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column };
                        if (ranges) {
                            yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
                        }
                        r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
                        if (typeof r !== "undefined") {
                            return r;
                        }
                        if (len) {
                            stack = stack.slice(0, -1 * len * 2);
                            vstack = vstack.slice(0, -1 * len);
                            lstack = lstack.slice(0, -1 * len);
                        }
                        stack.push(this.productions_[action[1]][0]);
                        vstack.push(yyval.$);
                        lstack.push(yyval._$);
                        newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                        stack.push(newState);
                        break;
                    case 3:
                        return true;
                }
            }
            return true;
        }
    };
    /* Jison generated lexer */
    var lexer = (function () {
        var lexer = { EOF: 1,
            parseError: function parseError(str, hash) {
                if (this.yy.parser) {
                    this.yy.parser.parseError(str, hash);
                } else {
                    throw new Error(str);
                }
            },
            setInput: function setInput(input) {
                this._input = input;
                this._more = this._less = this.done = false;
                this.yylineno = this.yyleng = 0;
                this.yytext = this.matched = this.match = '';
                this.conditionStack = ['INITIAL'];
                this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 };
                if (this.options.ranges) this.yylloc.range = [0, 0];
                this.offset = 0;
                return this;
            },
            input: function input() {
                var ch = this._input[0];
                this.yytext += ch;
                this.yyleng++;
                this.offset++;
                this.match += ch;
                this.matched += ch;
                var lines = ch.match(/(?:\r\n?|\n).*/g);
                if (lines) {
                    this.yylineno++;
                    this.yylloc.last_line++;
                } else {
                    this.yylloc.last_column++;
                }
                if (this.options.ranges) this.yylloc.range[1]++;

                this._input = this._input.slice(1);
                return ch;
            },
            unput: function unput(ch) {
                var len = ch.length;
                var lines = ch.split(/(?:\r\n?|\n)/g);

                this._input = ch + this._input;
                this.yytext = this.yytext.substr(0, this.yytext.length - len - 1);
                //this.yyleng -= len;
                this.offset -= len;
                var oldLines = this.match.split(/(?:\r\n?|\n)/g);
                this.match = this.match.substr(0, this.match.length - 1);
                this.matched = this.matched.substr(0, this.matched.length - 1);

                if (lines.length - 1) this.yylineno -= lines.length - 1;
                var r = this.yylloc.range;

                this.yylloc = { first_line: this.yylloc.first_line,
                    last_line: this.yylineno + 1,
                    first_column: this.yylloc.first_column,
                    last_column: lines ? (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length : this.yylloc.first_column - len
                };

                if (this.options.ranges) {
                    this.yylloc.range = [r[0], r[0] + this.yyleng - len];
                }
                return this;
            },
            more: function more() {
                this._more = true;
                return this;
            },
            less: function less(n) {
                this.unput(this.match.slice(n));
            },
            pastInput: function pastInput() {
                var past = this.matched.substr(0, this.matched.length - this.match.length);
                return (past.length > 20 ? '...' : '') + past.substr(-20).replace(/\n/g, "");
            },
            upcomingInput: function upcomingInput() {
                var next = this.match;
                if (next.length < 20) {
                    next += this._input.substr(0, 20 - next.length);
                }
                return (next.substr(0, 20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
            },
            showPosition: function showPosition() {
                var pre = this.pastInput();
                var c = new Array(pre.length + 1).join("-");
                return pre + this.upcomingInput() + "\n" + c + "^";
            },
            next: function next() {
                if (this.done) {
                    return this.EOF;
                }
                if (!this._input) this.done = true;

                var token, match, tempMatch, index, col, lines;
                if (!this._more) {
                    this.yytext = '';
                    this.match = '';
                }
                var rules = this._currentRules();
                for (var i = 0; i < rules.length; i++) {
                    tempMatch = this._input.match(this.rules[rules[i]]);
                    if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                        match = tempMatch;
                        index = i;
                        if (!this.options.flex) break;
                    }
                }
                if (match) {
                    lines = match[0].match(/(?:\r\n?|\n).*/g);
                    if (lines) this.yylineno += lines.length;
                    this.yylloc = { first_line: this.yylloc.last_line,
                        last_line: this.yylineno + 1,
                        first_column: this.yylloc.last_column,
                        last_column: lines ? lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length };
                    this.yytext += match[0];
                    this.match += match[0];
                    this.matches = match;
                    this.yyleng = this.yytext.length;
                    if (this.options.ranges) {
                        this.yylloc.range = [this.offset, this.offset += this.yyleng];
                    }
                    this._more = false;
                    this._input = this._input.slice(match[0].length);
                    this.matched += match[0];
                    token = this.performAction.call(this, this.yy, this, rules[index], this.conditionStack[this.conditionStack.length - 1]);
                    if (this.done && this._input) this.done = false;
                    if (token) return token;else return;
                }
                if (this._input === "") {
                    return this.EOF;
                } else {
                    return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), { text: "", token: null, line: this.yylineno });
                }
            },
            lex: function lex() {
                var r = this.next();
                if (typeof r !== 'undefined') {
                    return r;
                } else {
                    return this.lex();
                }
            },
            begin: function begin(condition) {
                this.conditionStack.push(condition);
            },
            popState: function popState() {
                return this.conditionStack.pop();
            },
            _currentRules: function _currentRules() {
                return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
            },
            topState: function topState() {
                return this.conditionStack[this.conditionStack.length - 2];
            },
            pushState: function begin(condition) {
                this.begin(condition);
            } };
        lexer.options = {};
        lexer.performAction = function anonymous(yy, yy_, $avoiding_name_collisions, YY_START
        /**/) {

            function strip(start, end) {
                return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng - end);
            }

            var YYSTATE = YY_START;
            switch ($avoiding_name_collisions) {
                case 0:
                    if (yy_.yytext.slice(-2) === "\\\\") {
                        strip(0, 1);
                        this.begin("mu");
                    } else if (yy_.yytext.slice(-1) === "\\") {
                        strip(0, 1);
                        this.begin("emu");
                    } else {
                        this.begin("mu");
                    }
                    if (yy_.yytext) return 15;

                    break;
                case 1:
                    return 15;
                    break;
                case 2:
                    this.popState();
                    return 15;

                    break;
                case 3:
                    this.begin('raw');return 15;
                    break;
                case 4:
                    this.popState();
                    // Should be using `this.topState()` below, but it currently
                    // returns the second top instead of the first top. Opened an
                    // issue about it at https://github.com/zaach/jison/issues/291
                    if (this.conditionStack[this.conditionStack.length - 1] === 'raw') {
                        return 15;
                    } else {
                        yy_.yytext = yy_.yytext.substr(5, yy_.yyleng - 9);
                        return 'END_RAW_BLOCK';
                    }

                    break;
                case 5:
                    return 15;
                    break;
                case 6:
                    this.popState();
                    return 14;

                    break;
                case 7:
                    return 65;
                    break;
                case 8:
                    return 68;
                    break;
                case 9:
                    return 19;
                    break;
                case 10:
                    this.popState();
                    this.begin('raw');
                    return 23;

                    break;
                case 11:
                    return 55;
                    break;
                case 12:
                    return 60;
                    break;
                case 13:
                    return 29;
                    break;
                case 14:
                    return 47;
                    break;
                case 15:
                    this.popState();return 44;
                    break;
                case 16:
                    this.popState();return 44;
                    break;
                case 17:
                    return 34;
                    break;
                case 18:
                    return 39;
                    break;
                case 19:
                    return 51;
                    break;
                case 20:
                    return 48;
                    break;
                case 21:
                    this.unput(yy_.yytext);
                    this.popState();
                    this.begin('com');

                    break;
                case 22:
                    this.popState();
                    return 14;

                    break;
                case 23:
                    return 48;
                    break;
                case 24:
                    return 73;
                    break;
                case 25:
                    return 72;
                    break;
                case 26:
                    return 72;
                    break;
                case 27:
                    return 87;
                    break;
                case 28:
                    // ignore whitespace
                    break;
                case 29:
                    this.popState();return 54;
                    break;
                case 30:
                    this.popState();return 33;
                    break;
                case 31:
                    yy_.yytext = strip(1, 2).replace(/\\"/g, '"');return 80;
                    break;
                case 32:
                    yy_.yytext = strip(1, 2).replace(/\\'/g, "'");return 80;
                    break;
                case 33:
                    return 85;
                    break;
                case 34:
                    return 82;
                    break;
                case 35:
                    return 82;
                    break;
                case 36:
                    return 83;
                    break;
                case 37:
                    return 84;
                    break;
                case 38:
                    return 81;
                    break;
                case 39:
                    return 75;
                    break;
                case 40:
                    return 77;
                    break;
                case 41:
                    return 72;
                    break;
                case 42:
                    yy_.yytext = yy_.yytext.replace(/\\([\\\]])/g, '$1');return 72;
                    break;
                case 43:
                    return 'INVALID';
                    break;
                case 44:
                    return 5;
                    break;
            }
        };
        lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/, /^(?:[^\x00]+)/, /^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/, /^(?:\{\{\{\{(?=[^\/]))/, /^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/, /^(?:[^\x00]*?(?=(\{\{\{\{)))/, /^(?:[\s\S]*?--(~)?\}\})/, /^(?:\()/, /^(?:\))/, /^(?:\{\{\{\{)/, /^(?:\}\}\}\})/, /^(?:\{\{(~)?>)/, /^(?:\{\{(~)?#>)/, /^(?:\{\{(~)?#\*?)/, /^(?:\{\{(~)?\/)/, /^(?:\{\{(~)?\^\s*(~)?\}\})/, /^(?:\{\{(~)?\s*else\s*(~)?\}\})/, /^(?:\{\{(~)?\^)/, /^(?:\{\{(~)?\s*else\b)/, /^(?:\{\{(~)?\{)/, /^(?:\{\{(~)?&)/, /^(?:\{\{(~)?!--)/, /^(?:\{\{(~)?![\s\S]*?\}\})/, /^(?:\{\{(~)?\*?)/, /^(?:=)/, /^(?:\.\.)/, /^(?:\.(?=([=~}\s\/.)|])))/, /^(?:[\/.])/, /^(?:\s+)/, /^(?:\}(~)?\}\})/, /^(?:(~)?\}\})/, /^(?:"(\\["]|[^"])*")/, /^(?:'(\\[']|[^'])*')/, /^(?:@)/, /^(?:true(?=([~}\s)])))/, /^(?:false(?=([~}\s)])))/, /^(?:undefined(?=([~}\s)])))/, /^(?:null(?=([~}\s)])))/, /^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/, /^(?:as\s+\|)/, /^(?:\|)/, /^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/, /^(?:\[(\\\]|[^\]])*\])/, /^(?:.)/, /^(?:$)/];
        lexer.conditions = { "mu": { "rules": [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44], "inclusive": false }, "emu": { "rules": [2], "inclusive": false }, "com": { "rules": [6], "inclusive": false }, "raw": { "rules": [3, 4, 5], "inclusive": false }, "INITIAL": { "rules": [0, 1, 44], "inclusive": true } };
        return lexer;
    })();
    parser.lexer = lexer;
    function Parser() {
        this.yy = {};
    }Parser.prototype = parser;parser.Parser = Parser;
    return new Parser();
})();exports["default"] = handlebars;
module.exports = exports["default"];


},{}],13:[function(require,module,exports){
/* eslint-disable new-cap */
'use strict';

exports.__esModule = true;
exports.print = print;
exports.PrintVisitor = PrintVisitor;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _visitor = require('./visitor');

var _visitor2 = _interopRequireDefault(_visitor);

function print(ast) {
  return new PrintVisitor().accept(ast);
}

function PrintVisitor() {
  this.padding = 0;
}

PrintVisitor.prototype = new _visitor2['default']();

PrintVisitor.prototype.pad = function (string) {
  var out = '';

  for (var i = 0, l = this.padding; i < l; i++) {
    out += '  ';
  }

  out += string + '\n';
  return out;
};

PrintVisitor.prototype.Program = function (program) {
  var out = '',
      body = program.body,
      i = undefined,
      l = undefined;

  if (program.blockParams) {
    var blockParams = 'BLOCK PARAMS: [';
    for (i = 0, l = program.blockParams.length; i < l; i++) {
      blockParams += ' ' + program.blockParams[i];
    }
    blockParams += ' ]';
    out += this.pad(blockParams);
  }

  for (i = 0, l = body.length; i < l; i++) {
    out += this.accept(body[i]);
  }

  this.padding--;

  return out;
};

PrintVisitor.prototype.MustacheStatement = function (mustache) {
  return this.pad('{{ ' + this.SubExpression(mustache) + ' }}');
};
PrintVisitor.prototype.Decorator = function (mustache) {
  return this.pad('{{ DIRECTIVE ' + this.SubExpression(mustache) + ' }}');
};

PrintVisitor.prototype.BlockStatement = PrintVisitor.prototype.DecoratorBlock = function (block) {
  var out = '';

  out += this.pad((block.type === 'DecoratorBlock' ? 'DIRECTIVE ' : '') + 'BLOCK:');
  this.padding++;
  out += this.pad(this.SubExpression(block));
  if (block.program) {
    out += this.pad('PROGRAM:');
    this.padding++;
    out += this.accept(block.program);
    this.padding--;
  }
  if (block.inverse) {
    if (block.program) {
      this.padding++;
    }
    out += this.pad('{{^}}');
    this.padding++;
    out += this.accept(block.inverse);
    this.padding--;
    if (block.program) {
      this.padding--;
    }
  }
  this.padding--;

  return out;
};

PrintVisitor.prototype.PartialStatement = function (partial) {
  var content = 'PARTIAL:' + partial.name.original;
  if (partial.params[0]) {
    content += ' ' + this.accept(partial.params[0]);
  }
  if (partial.hash) {
    content += ' ' + this.accept(partial.hash);
  }
  return this.pad('{{> ' + content + ' }}');
};
PrintVisitor.prototype.PartialBlockStatement = function (partial) {
  var content = 'PARTIAL BLOCK:' + partial.name.original;
  if (partial.params[0]) {
    content += ' ' + this.accept(partial.params[0]);
  }
  if (partial.hash) {
    content += ' ' + this.accept(partial.hash);
  }

  content += ' ' + this.pad('PROGRAM:');
  this.padding++;
  content += this.accept(partial.program);
  this.padding--;

  return this.pad('{{> ' + content + ' }}');
};

PrintVisitor.prototype.ContentStatement = function (content) {
  return this.pad("CONTENT[ '" + content.value + "' ]");
};

PrintVisitor.prototype.CommentStatement = function (comment) {
  return this.pad("{{! '" + comment.value + "' }}");
};

PrintVisitor.prototype.SubExpression = function (sexpr) {
  var params = sexpr.params,
      paramStrings = [],
      hash = undefined;

  for (var i = 0, l = params.length; i < l; i++) {
    paramStrings.push(this.accept(params[i]));
  }

  params = '[' + paramStrings.join(', ') + ']';

  hash = sexpr.hash ? ' ' + this.accept(sexpr.hash) : '';

  return this.accept(sexpr.path) + ' ' + params + hash;
};

PrintVisitor.prototype.PathExpression = function (id) {
  var path = id.parts.join('/');
  return (id.data ? '@' : '') + 'PATH:' + path;
};

PrintVisitor.prototype.StringLiteral = function (string) {
  return '"' + string.value + '"';
};

PrintVisitor.prototype.NumberLiteral = function (number) {
  return 'NUMBER{' + number.value + '}';
};

PrintVisitor.prototype.BooleanLiteral = function (bool) {
  return 'BOOLEAN{' + bool.value + '}';
};

PrintVisitor.prototype.UndefinedLiteral = function () {
  return 'UNDEFINED';
};

PrintVisitor.prototype.NullLiteral = function () {
  return 'NULL';
};

PrintVisitor.prototype.Hash = function (hash) {
  var pairs = hash.pairs,
      joinedPairs = [];

  for (var i = 0, l = pairs.length; i < l; i++) {
    joinedPairs.push(this.accept(pairs[i]));
  }

  return 'HASH{' + joinedPairs.join(', ') + '}';
};
PrintVisitor.prototype.HashPair = function (pair) {
  return pair.key + '=' + this.accept(pair.value);
};
/* eslint-enable new-cap */


},{"./visitor":14}],14:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

function Visitor() {
  this.parents = [];
}

Visitor.prototype = {
  constructor: Visitor,
  mutating: false,

  // Visits a given value. If mutating, will replace the value if necessary.
  acceptKey: function acceptKey(node, name) {
    var value = this.accept(node[name]);
    if (this.mutating) {
      // Hacky sanity check: This may have a few false positives for type for the helper
      // methods but will generally do the right thing without a lot of overhead.
      if (value && !Visitor.prototype[value.type]) {
        throw new _exception2['default']('Unexpected node type "' + value.type + '" found when accepting ' + name + ' on ' + node.type);
      }
      node[name] = value;
    }
  },

  // Performs an accept operation with added sanity check to ensure
  // required keys are not removed.
  acceptRequired: function acceptRequired(node, name) {
    this.acceptKey(node, name);

    if (!node[name]) {
      throw new _exception2['default'](node.type + ' requires ' + name);
    }
  },

  // Traverses a given array. If mutating, empty respnses will be removed
  // for child elements.
  acceptArray: function acceptArray(array) {
    for (var i = 0, l = array.length; i < l; i++) {
      this.acceptKey(array, i);

      if (!array[i]) {
        array.splice(i, 1);
        i--;
        l--;
      }
    }
  },

  accept: function accept(object) {
    if (!object) {
      return;
    }

    /* istanbul ignore next: Sanity code */
    if (!this[object.type]) {
      throw new _exception2['default']('Unknown type: ' + object.type, object);
    }

    if (this.current) {
      this.parents.unshift(this.current);
    }
    this.current = object;

    var ret = this[object.type](object);

    this.current = this.parents.shift();

    if (!this.mutating || ret) {
      return ret;
    } else if (ret !== false) {
      return object;
    }
  },

  Program: function Program(program) {
    this.acceptArray(program.body);
  },

  MustacheStatement: visitSubExpression,
  Decorator: visitSubExpression,

  BlockStatement: visitBlock,
  DecoratorBlock: visitBlock,

  PartialStatement: visitPartial,
  PartialBlockStatement: function PartialBlockStatement(partial) {
    visitPartial.call(this, partial);

    this.acceptKey(partial, 'program');
  },

  ContentStatement: function ContentStatement() /* content */{},
  CommentStatement: function CommentStatement() /* comment */{},

  SubExpression: visitSubExpression,

  PathExpression: function PathExpression() /* path */{},

  StringLiteral: function StringLiteral() /* string */{},
  NumberLiteral: function NumberLiteral() /* number */{},
  BooleanLiteral: function BooleanLiteral() /* bool */{},
  UndefinedLiteral: function UndefinedLiteral() /* literal */{},
  NullLiteral: function NullLiteral() /* literal */{},

  Hash: function Hash(hash) {
    this.acceptArray(hash.pairs);
  },
  HashPair: function HashPair(pair) {
    this.acceptRequired(pair, 'value');
  }
};

function visitSubExpression(mustache) {
  this.acceptRequired(mustache, 'path');
  this.acceptArray(mustache.params);
  this.acceptKey(mustache, 'hash');
}
function visitBlock(block) {
  visitSubExpression.call(this, block);

  this.acceptKey(block, 'program');
  this.acceptKey(block, 'inverse');
}
function visitPartial(partial) {
  this.acceptRequired(partial, 'name');
  this.acceptArray(partial.params);
  this.acceptKey(partial, 'hash');
}

exports['default'] = Visitor;
module.exports = exports['default'];


},{"../exception":18}],15:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _visitor = require('./visitor');

var _visitor2 = _interopRequireDefault(_visitor);

function WhitespaceControl() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  this.options = options;
}
WhitespaceControl.prototype = new _visitor2['default']();

WhitespaceControl.prototype.Program = function (program) {
  var doStandalone = !this.options.ignoreStandalone;

  var isRoot = !this.isRootSeen;
  this.isRootSeen = true;

  var body = program.body;
  for (var i = 0, l = body.length; i < l; i++) {
    var current = body[i],
        strip = this.accept(current);

    if (!strip) {
      continue;
    }

    var _isPrevWhitespace = isPrevWhitespace(body, i, isRoot),
        _isNextWhitespace = isNextWhitespace(body, i, isRoot),
        openStandalone = strip.openStandalone && _isPrevWhitespace,
        closeStandalone = strip.closeStandalone && _isNextWhitespace,
        inlineStandalone = strip.inlineStandalone && _isPrevWhitespace && _isNextWhitespace;

    if (strip.close) {
      omitRight(body, i, true);
    }
    if (strip.open) {
      omitLeft(body, i, true);
    }

    if (doStandalone && inlineStandalone) {
      omitRight(body, i);

      if (omitLeft(body, i)) {
        // If we are on a standalone node, save the indent info for partials
        if (current.type === 'PartialStatement') {
          // Pull out the whitespace from the final line
          current.indent = /([ \t]+$)/.exec(body[i - 1].original)[1];
        }
      }
    }
    if (doStandalone && openStandalone) {
      omitRight((current.program || current.inverse).body);

      // Strip out the previous content node if it's whitespace only
      omitLeft(body, i);
    }
    if (doStandalone && closeStandalone) {
      // Always strip the next node
      omitRight(body, i);

      omitLeft((current.inverse || current.program).body);
    }
  }

  return program;
};

WhitespaceControl.prototype.BlockStatement = WhitespaceControl.prototype.DecoratorBlock = WhitespaceControl.prototype.PartialBlockStatement = function (block) {
  this.accept(block.program);
  this.accept(block.inverse);

  // Find the inverse program that is involed with whitespace stripping.
  var program = block.program || block.inverse,
      inverse = block.program && block.inverse,
      firstInverse = inverse,
      lastInverse = inverse;

  if (inverse && inverse.chained) {
    firstInverse = inverse.body[0].program;

    // Walk the inverse chain to find the last inverse that is actually in the chain.
    while (lastInverse.chained) {
      lastInverse = lastInverse.body[lastInverse.body.length - 1].program;
    }
  }

  var strip = {
    open: block.openStrip.open,
    close: block.closeStrip.close,

    // Determine the standalone candiacy. Basically flag our content as being possibly standalone
    // so our parent can determine if we actually are standalone
    openStandalone: isNextWhitespace(program.body),
    closeStandalone: isPrevWhitespace((firstInverse || program).body)
  };

  if (block.openStrip.close) {
    omitRight(program.body, null, true);
  }

  if (inverse) {
    var inverseStrip = block.inverseStrip;

    if (inverseStrip.open) {
      omitLeft(program.body, null, true);
    }

    if (inverseStrip.close) {
      omitRight(firstInverse.body, null, true);
    }
    if (block.closeStrip.open) {
      omitLeft(lastInverse.body, null, true);
    }

    // Find standalone else statments
    if (!this.options.ignoreStandalone && isPrevWhitespace(program.body) && isNextWhitespace(firstInverse.body)) {
      omitLeft(program.body);
      omitRight(firstInverse.body);
    }
  } else if (block.closeStrip.open) {
    omitLeft(program.body, null, true);
  }

  return strip;
};

WhitespaceControl.prototype.Decorator = WhitespaceControl.prototype.MustacheStatement = function (mustache) {
  return mustache.strip;
};

WhitespaceControl.prototype.PartialStatement = WhitespaceControl.prototype.CommentStatement = function (node) {
  /* istanbul ignore next */
  var strip = node.strip || {};
  return {
    inlineStandalone: true,
    open: strip.open,
    close: strip.close
  };
};

function isPrevWhitespace(body, i, isRoot) {
  if (i === undefined) {
    i = body.length;
  }

  // Nodes that end with newlines are considered whitespace (but are special
  // cased for strip operations)
  var prev = body[i - 1],
      sibling = body[i - 2];
  if (!prev) {
    return isRoot;
  }

  if (prev.type === 'ContentStatement') {
    return (sibling || !isRoot ? /\r?\n\s*?$/ : /(^|\r?\n)\s*?$/).test(prev.original);
  }
}
function isNextWhitespace(body, i, isRoot) {
  if (i === undefined) {
    i = -1;
  }

  var next = body[i + 1],
      sibling = body[i + 2];
  if (!next) {
    return isRoot;
  }

  if (next.type === 'ContentStatement') {
    return (sibling || !isRoot ? /^\s*?\r?\n/ : /^\s*?(\r?\n|$)/).test(next.original);
  }
}

// Marks the node to the right of the position as omitted.
// I.e. {{foo}}' ' will mark the ' ' node as omitted.
//
// If i is undefined, then the first child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitRight(body, i, multiple) {
  var current = body[i == null ? 0 : i + 1];
  if (!current || current.type !== 'ContentStatement' || !multiple && current.rightStripped) {
    return;
  }

  var original = current.value;
  current.value = current.value.replace(multiple ? /^\s+/ : /^[ \t]*\r?\n?/, '');
  current.rightStripped = current.value !== original;
}

// Marks the node to the left of the position as omitted.
// I.e. ' '{{foo}} will mark the ' ' node as omitted.
//
// If i is undefined then the last child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitLeft(body, i, multiple) {
  var current = body[i == null ? body.length - 1 : i - 1];
  if (!current || current.type !== 'ContentStatement' || !multiple && current.leftStripped) {
    return;
  }

  // We omit the last node if it's whitespace only and not preceeded by a non-content node.
  var original = current.value;
  current.value = current.value.replace(multiple ? /\s+$/ : /[ \t]+$/, '');
  current.leftStripped = current.value !== original;
  return current.leftStripped;
}

exports['default'] = WhitespaceControl;
module.exports = exports['default'];


},{"./visitor":14}],16:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.registerDefaultDecorators = registerDefaultDecorators;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _decoratorsInline = require('./decorators/inline');

var _decoratorsInline2 = _interopRequireDefault(_decoratorsInline);

function registerDefaultDecorators(instance) {
  _decoratorsInline2['default'](instance);
}


},{"./decorators/inline":17}],17:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerDecorator('inline', function (fn, props, container, options) {
    var ret = fn;
    if (!props.partials) {
      props.partials = {};
      ret = function (context, options) {
        // Create a new partials stack frame prior to exec.
        var original = container.partials;
        container.partials = _utils.extend({}, original, props.partials);
        var ret = fn(context, options);
        container.partials = original;
        return ret;
      };
    }

    props.partials[options.args[0]] = options.fn;

    return ret;
  });
};

module.exports = exports['default'];


},{"../utils":31}],18:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var loc = node && node.loc,
      line = undefined,
      column = undefined;
  if (loc) {
    line = loc.start.line;
    column = loc.start.column;

    message += ' - ' + line + ':' + column;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  /* istanbul ignore else */
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, Exception);
  }

  try {
    if (loc) {
      this.lineNumber = line;

      // Work around issue under safari where we can't directly set the column value
      /* istanbul ignore next */
      if (Object.defineProperty) {
        Object.defineProperty(this, 'column', {
          value: column,
          enumerable: true
        });
      } else {
        this.column = column;
      }
    }
  } catch (nop) {
    /* Ignore if the browser is very particular */
  }
}

Exception.prototype = new Error();

exports['default'] = Exception;
module.exports = exports['default'];


},{}],19:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.registerDefaultHelpers = registerDefaultHelpers;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _helpersBlockHelperMissing = require('./helpers/block-helper-missing');

var _helpersBlockHelperMissing2 = _interopRequireDefault(_helpersBlockHelperMissing);

var _helpersEach = require('./helpers/each');

var _helpersEach2 = _interopRequireDefault(_helpersEach);

var _helpersHelperMissing = require('./helpers/helper-missing');

var _helpersHelperMissing2 = _interopRequireDefault(_helpersHelperMissing);

var _helpersIf = require('./helpers/if');

var _helpersIf2 = _interopRequireDefault(_helpersIf);

var _helpersLog = require('./helpers/log');

var _helpersLog2 = _interopRequireDefault(_helpersLog);

var _helpersLookup = require('./helpers/lookup');

var _helpersLookup2 = _interopRequireDefault(_helpersLookup);

var _helpersWith = require('./helpers/with');

var _helpersWith2 = _interopRequireDefault(_helpersWith);

function registerDefaultHelpers(instance) {
  _helpersBlockHelperMissing2['default'](instance);
  _helpersEach2['default'](instance);
  _helpersHelperMissing2['default'](instance);
  _helpersIf2['default'](instance);
  _helpersLog2['default'](instance);
  _helpersLookup2['default'](instance);
  _helpersWith2['default'](instance);
}


},{"./helpers/block-helper-missing":20,"./helpers/each":21,"./helpers/helper-missing":22,"./helpers/if":23,"./helpers/log":24,"./helpers/lookup":25,"./helpers/with":26}],20:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('blockHelperMissing', function (context, options) {
    var inverse = options.inverse,
        fn = options.fn;

    if (context === true) {
      return fn(this);
    } else if (context === false || context == null) {
      return inverse(this);
    } else if (_utils.isArray(context)) {
      if (context.length > 0) {
        if (options.ids) {
          options.ids = [options.name];
        }

        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      if (options.data && options.ids) {
        var data = _utils.createFrame(options.data);
        data.contextPath = _utils.appendContextPath(options.data.contextPath, options.name);
        options = { data: data };
      }

      return fn(context, options);
    }
  });
};

module.exports = exports['default'];


},{"../utils":31}],21:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _utils = require('../utils');

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

exports['default'] = function (instance) {
  instance.registerHelper('each', function (context, options) {
    if (!options) {
      throw new _exception2['default']('Must pass iterator to #each');
    }

    var fn = options.fn,
        inverse = options.inverse,
        i = 0,
        ret = '',
        data = undefined,
        contextPath = undefined;

    if (options.data && options.ids) {
      contextPath = _utils.appendContextPath(options.data.contextPath, options.ids[0]) + '.';
    }

    if (_utils.isFunction(context)) {
      context = context.call(this);
    }

    if (options.data) {
      data = _utils.createFrame(options.data);
    }

    function execIteration(field, index, last) {
      if (data) {
        data.key = field;
        data.index = index;
        data.first = index === 0;
        data.last = !!last;

        if (contextPath) {
          data.contextPath = contextPath + field;
        }
      }

      ret = ret + fn(context[field], {
        data: data,
        blockParams: _utils.blockParams([context[field], field], [contextPath + field, null])
      });
    }

    if (context && typeof context === 'object') {
      if (_utils.isArray(context)) {
        for (var j = context.length; i < j; i++) {
          if (i in context) {
            execIteration(i, i, i === context.length - 1);
          }
        }
      } else {
        var priorKey = undefined;

        for (var key in context) {
          if (context.hasOwnProperty(key)) {
            // We're running the iterations one step out of sync so we can detect
            // the last iteration without have to scan the object twice and create
            // an itermediate keys array.
            if (priorKey !== undefined) {
              execIteration(priorKey, i - 1);
            }
            priorKey = key;
            i++;
          }
        }
        if (priorKey !== undefined) {
          execIteration(priorKey, i - 1, true);
        }
      }
    }

    if (i === 0) {
      ret = inverse(this);
    }

    return ret;
  });
};

module.exports = exports['default'];


},{"../exception":18,"../utils":31}],22:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

exports['default'] = function (instance) {
  instance.registerHelper('helperMissing', function () /* [args, ]options */{
    if (arguments.length === 1) {
      // A missing field in a {{foo}} construct.
      return undefined;
    } else {
      // Someone is actually trying to call something, blow up.
      throw new _exception2['default']('Missing helper: "' + arguments[arguments.length - 1].name + '"');
    }
  });
};

module.exports = exports['default'];


},{"../exception":18}],23:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('if', function (conditional, options) {
    if (_utils.isFunction(conditional)) {
      conditional = conditional.call(this);
    }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if (!options.hash.includeZero && !conditional || _utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function (conditional, options) {
    return instance.helpers['if'].call(this, conditional, { fn: options.inverse, inverse: options.fn, hash: options.hash });
  });
};

module.exports = exports['default'];


},{"../utils":31}],24:[function(require,module,exports){
'use strict';

exports.__esModule = true;

exports['default'] = function (instance) {
  instance.registerHelper('log', function () /* message, options */{
    var args = [undefined],
        options = arguments[arguments.length - 1];
    for (var i = 0; i < arguments.length - 1; i++) {
      args.push(arguments[i]);
    }

    var level = 1;
    if (options.hash.level != null) {
      level = options.hash.level;
    } else if (options.data && options.data.level != null) {
      level = options.data.level;
    }
    args[0] = level;

    instance.log.apply(instance, args);
  });
};

module.exports = exports['default'];


},{}],25:[function(require,module,exports){
'use strict';

exports.__esModule = true;

exports['default'] = function (instance) {
  instance.registerHelper('lookup', function (obj, field) {
    return obj && obj[field];
  });
};

module.exports = exports['default'];


},{}],26:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('with', function (context, options) {
    if (_utils.isFunction(context)) {
      context = context.call(this);
    }

    var fn = options.fn;

    if (!_utils.isEmpty(context)) {
      var data = options.data;
      if (options.data && options.ids) {
        data = _utils.createFrame(options.data);
        data.contextPath = _utils.appendContextPath(options.data.contextPath, options.ids[0]);
      }

      return fn(context, {
        data: data,
        blockParams: _utils.blockParams([context], [data && data.contextPath])
      });
    } else {
      return options.inverse(this);
    }
  });
};

module.exports = exports['default'];


},{"../utils":31}],27:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('./utils');

var logger = {
  methodMap: ['debug', 'info', 'warn', 'error'],
  level: 'info',

  // Maps a given level value to the `methodMap` indexes above.
  lookupLevel: function lookupLevel(level) {
    if (typeof level === 'string') {
      var levelMap = _utils.indexOf(logger.methodMap, level.toLowerCase());
      if (levelMap >= 0) {
        level = levelMap;
      } else {
        level = parseInt(level, 10);
      }
    }

    return level;
  },

  // Can be overridden in the host environment
  log: function log(level) {
    level = logger.lookupLevel(level);

    if (typeof console !== 'undefined' && logger.lookupLevel(logger.level) <= level) {
      var method = logger.methodMap[level];
      if (!console[method]) {
        // eslint-disable-line no-console
        method = 'log';
      }

      for (var _len = arguments.length, message = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        message[_key - 1] = arguments[_key];
      }

      console[method].apply(console, message); // eslint-disable-line no-console
    }
  }
};

exports['default'] = logger;
module.exports = exports['default'];


},{"./utils":31}],28:[function(require,module,exports){
(function (global){
/* global window */
'use strict';

exports.__esModule = true;

exports['default'] = function (Handlebars) {
  /* istanbul ignore next */
  var root = typeof global !== 'undefined' ? global : window,
      $Handlebars = root.Handlebars;
  /* istanbul ignore next */
  Handlebars.noConflict = function () {
    if (root.Handlebars === Handlebars) {
      root.Handlebars = $Handlebars;
    }
    return Handlebars;
  };
};

module.exports = exports['default'];


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],29:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.checkRevision = checkRevision;
exports.template = template;
exports.wrapProgram = wrapProgram;
exports.resolvePartial = resolvePartial;
exports.invokePartial = invokePartial;
exports.noop = noop;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _utils = require('./utils');

var Utils = _interopRequireWildcard(_utils);

var _exception = require('./exception');

var _exception2 = _interopRequireDefault(_exception);

var _base = require('./base');

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = _base.COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = _base.REVISION_CHANGES[currentRevision],
          compilerVersions = _base.REVISION_CHANGES[compilerRevision];
      throw new _exception2['default']('Template was precompiled with an older version of Handlebars than the current runtime. ' + 'Please update your precompiler to a newer version (' + runtimeVersions + ') or downgrade your runtime to an older version (' + compilerVersions + ').');
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new _exception2['default']('Template was precompiled with a newer version of Handlebars than the current runtime. ' + 'Please update your runtime to a newer version (' + compilerInfo[1] + ').');
    }
  }
}

function template(templateSpec, env) {
  /* istanbul ignore next */
  if (!env) {
    throw new _exception2['default']('No environment passed to template');
  }
  if (!templateSpec || !templateSpec.main) {
    throw new _exception2['default']('Unknown template object: ' + typeof templateSpec);
  }

  templateSpec.main.decorator = templateSpec.main_d;

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  env.VM.checkRevision(templateSpec.compiler);

  function invokePartialWrapper(partial, context, options) {
    if (options.hash) {
      context = Utils.extend({}, context, options.hash);
      if (options.ids) {
        options.ids[0] = true;
      }
    }

    partial = env.VM.resolvePartial.call(this, partial, context, options);
    var result = env.VM.invokePartial.call(this, partial, context, options);

    if (result == null && env.compile) {
      options.partials[options.name] = env.compile(partial, templateSpec.compilerOptions, env);
      result = options.partials[options.name](context, options);
    }
    if (result != null) {
      if (options.indent) {
        var lines = result.split('\n');
        for (var i = 0, l = lines.length; i < l; i++) {
          if (!lines[i] && i + 1 === l) {
            break;
          }

          lines[i] = options.indent + lines[i];
        }
        result = lines.join('\n');
      }
      return result;
    } else {
      throw new _exception2['default']('The partial ' + options.name + ' could not be compiled when running in runtime-only mode');
    }
  }

  // Just add water
  var container = {
    strict: function strict(obj, name) {
      if (!(name in obj)) {
        throw new _exception2['default']('"' + name + '" not defined in ' + obj);
      }
      return obj[name];
    },
    lookup: function lookup(depths, name) {
      var len = depths.length;
      for (var i = 0; i < len; i++) {
        if (depths[i] && depths[i][name] != null) {
          return depths[i][name];
        }
      }
    },
    lambda: function lambda(current, context) {
      return typeof current === 'function' ? current.call(context) : current;
    },

    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,

    fn: function fn(i) {
      var ret = templateSpec[i];
      ret.decorator = templateSpec[i + '_d'];
      return ret;
    },

    programs: [],
    program: function program(i, data, declaredBlockParams, blockParams, depths) {
      var programWrapper = this.programs[i],
          fn = this.fn(i);
      if (data || depths || blockParams || declaredBlockParams) {
        programWrapper = wrapProgram(this, i, fn, data, declaredBlockParams, blockParams, depths);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = wrapProgram(this, i, fn);
      }
      return programWrapper;
    },

    data: function data(value, depth) {
      while (value && depth--) {
        value = value._parent;
      }
      return value;
    },
    merge: function merge(param, common) {
      var obj = param || common;

      if (param && common && param !== common) {
        obj = Utils.extend({}, common, param);
      }

      return obj;
    },
    // An empty object to use as replacement for null-contexts
    nullContext: Object.seal({}),

    noop: env.VM.noop,
    compilerInfo: templateSpec.compiler
  };

  function ret(context) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var data = options.data;

    ret._setup(options);
    if (!options.partial && templateSpec.useData) {
      data = initData(context, data);
    }
    var depths = undefined,
        blockParams = templateSpec.useBlockParams ? [] : undefined;
    if (templateSpec.useDepths) {
      if (options.depths) {
        depths = context != options.depths[0] ? [context].concat(options.depths) : options.depths;
      } else {
        depths = [context];
      }
    }

    function main(context /*, options*/) {
      return '' + templateSpec.main(container, context, container.helpers, container.partials, data, blockParams, depths);
    }
    main = executeDecorators(templateSpec.main, main, container, options.depths || [], data, blockParams);
    return main(context, options);
  }
  ret.isTop = true;

  ret._setup = function (options) {
    if (!options.partial) {
      container.helpers = container.merge(options.helpers, env.helpers);

      if (templateSpec.usePartial) {
        container.partials = container.merge(options.partials, env.partials);
      }
      if (templateSpec.usePartial || templateSpec.useDecorators) {
        container.decorators = container.merge(options.decorators, env.decorators);
      }
    } else {
      container.helpers = options.helpers;
      container.partials = options.partials;
      container.decorators = options.decorators;
    }
  };

  ret._child = function (i, data, blockParams, depths) {
    if (templateSpec.useBlockParams && !blockParams) {
      throw new _exception2['default']('must pass block params');
    }
    if (templateSpec.useDepths && !depths) {
      throw new _exception2['default']('must pass parent depths');
    }

    return wrapProgram(container, i, templateSpec[i], data, 0, blockParams, depths);
  };
  return ret;
}

function wrapProgram(container, i, fn, data, declaredBlockParams, blockParams, depths) {
  function prog(context) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var currentDepths = depths;
    if (depths && context != depths[0] && !(context === container.nullContext && depths[0] === null)) {
      currentDepths = [context].concat(depths);
    }

    return fn(container, context, container.helpers, container.partials, options.data || data, blockParams && [options.blockParams].concat(blockParams), currentDepths);
  }

  prog = executeDecorators(fn, prog, container, depths, data, blockParams);

  prog.program = i;
  prog.depth = depths ? depths.length : 0;
  prog.blockParams = declaredBlockParams || 0;
  return prog;
}

function resolvePartial(partial, context, options) {
  if (!partial) {
    if (options.name === '@partial-block') {
      partial = options.data['partial-block'];
    } else {
      partial = options.partials[options.name];
    }
  } else if (!partial.call && !options.name) {
    // This is a dynamic partial that returned a string
    options.name = partial;
    partial = options.partials[partial];
  }
  return partial;
}

function invokePartial(partial, context, options) {
  // Use the current closure context to save the partial-block if this partial
  var currentPartialBlock = options.data && options.data['partial-block'];
  options.partial = true;
  if (options.ids) {
    options.data.contextPath = options.ids[0] || options.data.contextPath;
  }

  var partialBlock = undefined;
  if (options.fn && options.fn !== noop) {
    (function () {
      options.data = _base.createFrame(options.data);
      // Wrapper function to get access to currentPartialBlock from the closure
      var fn = options.fn;
      partialBlock = options.data['partial-block'] = function partialBlockWrapper(context) {
        var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        // Restore the partial-block from the closure for the execution of the block
        // i.e. the part inside the block of the partial call.
        options.data = _base.createFrame(options.data);
        options.data['partial-block'] = currentPartialBlock;
        return fn(context, options);
      };
      if (fn.partials) {
        options.partials = Utils.extend({}, options.partials, fn.partials);
      }
    })();
  }

  if (partial === undefined && partialBlock) {
    partial = partialBlock;
  }

  if (partial === undefined) {
    throw new _exception2['default']('The partial ' + options.name + ' could not be found');
  } else if (partial instanceof Function) {
    return partial(context, options);
  }
}

function noop() {
  return '';
}

function initData(context, data) {
  if (!data || !('root' in data)) {
    data = data ? _base.createFrame(data) : {};
    data.root = context;
  }
  return data;
}

function executeDecorators(fn, prog, container, depths, data, blockParams) {
  if (fn.decorator) {
    var props = {};
    prog = fn.decorator(prog, props, container, depths && depths[0], data, blockParams, depths);
    Utils.extend(prog, props);
  }
  return prog;
}


},{"./base":5,"./exception":18,"./utils":31}],30:[function(require,module,exports){
// Build out our basic SafeString type
'use strict';

exports.__esModule = true;
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = SafeString.prototype.toHTML = function () {
  return '' + this.string;
};

exports['default'] = SafeString;
module.exports = exports['default'];


},{}],31:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.extend = extend;
exports.indexOf = indexOf;
exports.escapeExpression = escapeExpression;
exports.isEmpty = isEmpty;
exports.createFrame = createFrame;
exports.blockParams = blockParams;
exports.appendContextPath = appendContextPath;
var escape = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

var badChars = /[&<>"'`=]/g,
    possible = /[&<>"'`=]/;

function escapeChar(chr) {
  return escape[chr];
}

function extend(obj /* , ...source */) {
  for (var i = 1; i < arguments.length; i++) {
    for (var key in arguments[i]) {
      if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
        obj[key] = arguments[i][key];
      }
    }
  }

  return obj;
}

var toString = Object.prototype.toString;

exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
/* eslint-disable func-style */
var isFunction = function isFunction(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
/* istanbul ignore next */
if (isFunction(/x/)) {
  exports.isFunction = isFunction = function (value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
exports.isFunction = isFunction;

/* eslint-enable func-style */

/* istanbul ignore next */
var isArray = Array.isArray || function (value) {
  return value && typeof value === 'object' ? toString.call(value) === '[object Array]' : false;
};

exports.isArray = isArray;
// Older IE versions do not directly support indexOf so we must implement our own, sadly.

function indexOf(array, value) {
  for (var i = 0, len = array.length; i < len; i++) {
    if (array[i] === value) {
      return i;
    }
  }
  return -1;
}

function escapeExpression(string) {
  if (typeof string !== 'string') {
    // don't escape SafeStrings, since they're already safe
    if (string && string.toHTML) {
      return string.toHTML();
    } else if (string == null) {
      return '';
    } else if (!string) {
      return string + '';
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = '' + string;
  }

  if (!possible.test(string)) {
    return string;
  }
  return string.replace(badChars, escapeChar);
}

function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

function createFrame(object) {
  var frame = extend({}, object);
  frame._parent = object;
  return frame;
}

function blockParams(params, ids) {
  params.path = ids;
  return params;
}

function appendContextPath(contextPath, id) {
  return (contextPath ? contextPath + '.' : '') + id;
}


},{}],32:[function(require,module,exports){
// USAGE:
// var handlebars = require('handlebars');
/* eslint-disable no-var */

// var local = handlebars.create();

var handlebars = require('../dist/cjs/handlebars')['default'];

var printer = require('../dist/cjs/handlebars/compiler/printer');
handlebars.PrintVisitor = printer.PrintVisitor;
handlebars.print = printer.print;

module.exports = handlebars;

// Publish a Node.js require() handler for .handlebars and .hbs files
function extension(module, filename) {
  var fs = require('fs');
  var templateString = fs.readFileSync(filename, 'utf8');
  module.exports = handlebars.compile(templateString);
}
/* istanbul ignore else */
if (typeof require !== 'undefined' && require.extensions) {
  require.extensions['.handlebars'] = extension;
  require.extensions['.hbs'] = extension;
}

},{"../dist/cjs/handlebars":3,"../dist/cjs/handlebars/compiler/printer":13,"fs":2}],33:[function(require,module,exports){
/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
exports.SourceMapGenerator = require('./source-map/source-map-generator').SourceMapGenerator;
exports.SourceMapConsumer = require('./source-map/source-map-consumer').SourceMapConsumer;
exports.SourceNode = require('./source-map/source-node').SourceNode;

},{"./source-map/source-map-consumer":40,"./source-map/source-map-generator":41,"./source-map/source-node":42}],34:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * A data structure which is a combination of an array and a set. Adding a new
   * member is O(1), testing for membership is O(1), and finding the index of an
   * element is O(1). Removing elements from the set is not supported. Only
   * strings are supported for membership.
   */
  function ArraySet() {
    this._array = [];
    this._set = {};
  }

  /**
   * Static method for creating ArraySet instances from an existing array.
   */
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet();
    for (var i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };

  /**
   * Return how many unique items are in this ArraySet. If duplicates have been
   * added, than those do not count towards the size.
   *
   * @returns Number
   */
  ArraySet.prototype.size = function ArraySet_size() {
    return Object.getOwnPropertyNames(this._set).length;
  };

  /**
   * Add the given string to this set.
   *
   * @param String aStr
   */
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var isDuplicate = this.has(aStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      this._set[util.toSetString(aStr)] = idx;
    }
  };

  /**
   * Is the given string a member of this set?
   *
   * @param String aStr
   */
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    return Object.prototype.hasOwnProperty.call(this._set,
                                                util.toSetString(aStr));
  };

  /**
   * What is the index of the given string in the array?
   *
   * @param String aStr
   */
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (this.has(aStr)) {
      return this._set[util.toSetString(aStr)];
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };

  /**
   * What is the element at the given index?
   *
   * @param Number aIdx
   */
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error('No element indexed by ' + aIdx);
  };

  /**
   * Returns the array representation of this set (which has the proper indices
   * indicated by indexOf). Note that this is a copy of the internal array used
   * for storing the members so that no one can mess with internal state.
   */
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };

  exports.ArraySet = ArraySet;

});

},{"./util":43,"amdefine":1}],35:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64 = require('./base64');

  // A single base 64 digit can contain 6 bits of data. For the base 64 variable
  // length quantities we use in the source map spec, the first bit is the sign,
  // the next four bits are the actual value, and the 6th bit is the
  // continuation bit. The continuation bit tells us whether there are more
  // digits in this value following this digit.
  //
  //   Continuation
  //   |    Sign
  //   |    |
  //   V    V
  //   101011

  var VLQ_BASE_SHIFT = 5;

  // binary: 100000
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

  // binary: 011111
  var VLQ_BASE_MASK = VLQ_BASE - 1;

  // binary: 100000
  var VLQ_CONTINUATION_BIT = VLQ_BASE;

  /**
   * Converts from a two-complement value to a value where the sign bit is
   * placed in the least significant bit.  For example, as decimals:
   *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
   *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
   */
  function toVLQSigned(aValue) {
    return aValue < 0
      ? ((-aValue) << 1) + 1
      : (aValue << 1) + 0;
  }

  /**
   * Converts to a two-complement value from a value where the sign bit is
   * placed in the least significant bit.  For example, as decimals:
   *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
   *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
   */
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative
      ? -shifted
      : shifted;
  }

  /**
   * Returns the base 64 VLQ encoded value.
   */
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;

    var vlq = toVLQSigned(aValue);

    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        // There are still more digits in this value, so we must make sure the
        // continuation bit is marked.
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);

    return encoded;
  };

  /**
   * Decodes the next base 64 VLQ value from the given string and returns the
   * value and the rest of the string via the out parameter.
   */
  exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;

    do {
      if (aIndex >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }

      digit = base64.decode(aStr.charCodeAt(aIndex++));
      if (digit === -1) {
        throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
      }

      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);

    aOutParam.value = fromVLQSigned(result);
    aOutParam.rest = aIndex;
  };

});

},{"./base64":36,"amdefine":1}],36:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var intToCharMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');

  /**
   * Encode an integer in the range of 0 to 63 to a single base 64 digit.
   */
  exports.encode = function (number) {
    if (0 <= number && number < intToCharMap.length) {
      return intToCharMap[number];
    }
    throw new TypeError("Must be between 0 and 63: " + aNumber);
  };

  /**
   * Decode a single base 64 character code digit to an integer. Returns -1 on
   * failure.
   */
  exports.decode = function (charCode) {
    var bigA = 65;     // 'A'
    var bigZ = 90;     // 'Z'

    var littleA = 97;  // 'a'
    var littleZ = 122; // 'z'

    var zero = 48;     // '0'
    var nine = 57;     // '9'

    var plus = 43;     // '+'
    var slash = 47;    // '/'

    var littleOffset = 26;
    var numberOffset = 52;

    // 0 - 25: ABCDEFGHIJKLMNOPQRSTUVWXYZ
    if (bigA <= charCode && charCode <= bigZ) {
      return (charCode - bigA);
    }

    // 26 - 51: abcdefghijklmnopqrstuvwxyz
    if (littleA <= charCode && charCode <= littleZ) {
      return (charCode - littleA + littleOffset);
    }

    // 52 - 61: 0123456789
    if (zero <= charCode && charCode <= nine) {
      return (charCode - zero + numberOffset);
    }

    // 62: +
    if (charCode == plus) {
      return 62;
    }

    // 63: /
    if (charCode == slash) {
      return 63;
    }

    // Invalid base64 digit.
    return -1;
  };

});

},{"amdefine":1}],37:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  exports.GREATEST_LOWER_BOUND = 1;
  exports.LEAST_UPPER_BOUND = 2;

  /**
   * Recursive implementation of binary search.
   *
   * @param aLow Indices here and lower do not contain the needle.
   * @param aHigh Indices here and higher do not contain the needle.
   * @param aNeedle The element being searched for.
   * @param aHaystack The non-empty array being searched.
   * @param aCompare Function which takes two elements and returns -1, 0, or 1.
   * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
   *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   */
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
    // This function terminates when one of the following is true:
    //
    //   1. We find the exact element we are looking for.
    //
    //   2. We did not find the exact element, but we can return the index of
    //      the next-closest element.
    //
    //   3. We did not find the exact element, and there is no next-closest
    //      element than the one we are searching for, so we return -1.
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      // Found the element we are looking for.
      return mid;
    }
    else if (cmp > 0) {
      // Our needle is greater than aHaystack[mid].
      if (aHigh - mid > 1) {
        // The element is in the upper half.
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
      }

      // The exact needle element was not found in this haystack. Determine if
      // we are in termination case (3) or (2) and return the appropriate thing.
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return aHigh < aHaystack.length ? aHigh : -1;
      } else {
        return mid;
      }
    }
    else {
      // Our needle is less than aHaystack[mid].
      if (mid - aLow > 1) {
        // The element is in the lower half.
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
      }

      // we are in termination case (3) or (2) and return the appropriate thing.
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return mid;
      } else {
        return aLow < 0 ? -1 : aLow;
      }
    }
  }

  /**
   * This is an implementation of binary search which will always try and return
   * the index of the closest element if there is no exact hit. This is because
   * mappings between original and generated line/col pairs are single points,
   * and there is an implicit region between each of them, so a miss just means
   * that you aren't on the very start of a region.
   *
   * @param aNeedle The element you are looking for.
   * @param aHaystack The array that is being searched.
   * @param aCompare A function which takes the needle and an element in the
   *     array and returns -1, 0, or 1 depending on whether the needle is less
   *     than, equal to, or greater than the element, respectively.
   * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
   *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
   */
  exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
    if (aHaystack.length === 0) {
      return -1;
    }

    var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack,
                                aCompare, aBias || exports.GREATEST_LOWER_BOUND);
    if (index < 0) {
      return -1;
    }

    // We have found either the exact element, or the next-closest element than
    // the one we are searching for. However, there may be more than one such
    // element. Make sure we always return the smallest of these.
    while (index - 1 >= 0) {
      if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
        break;
      }
      --index;
    }

    return index;
  };

});

},{"amdefine":1}],38:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2014 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * Determine whether mappingB is after mappingA with respect to generated
   * position.
   */
  function generatedPositionAfter(mappingA, mappingB) {
    // Optimized for most common case
    var lineA = mappingA.generatedLine;
    var lineB = mappingB.generatedLine;
    var columnA = mappingA.generatedColumn;
    var columnB = mappingB.generatedColumn;
    return lineB > lineA || lineB == lineA && columnB >= columnA ||
           util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
  }

  /**
   * A data structure to provide a sorted view of accumulated mappings in a
   * performance conscious manner. It trades a neglibable overhead in general
   * case for a large speedup in case of mappings being added in order.
   */
  function MappingList() {
    this._array = [];
    this._sorted = true;
    // Serves as infimum
    this._last = {generatedLine: -1, generatedColumn: 0};
  }

  /**
   * Iterate through internal items. This method takes the same arguments that
   * `Array.prototype.forEach` takes.
   *
   * NOTE: The order of the mappings is NOT guaranteed.
   */
  MappingList.prototype.unsortedForEach =
    function MappingList_forEach(aCallback, aThisArg) {
      this._array.forEach(aCallback, aThisArg);
    };

  /**
   * Add the given source mapping.
   *
   * @param Object aMapping
   */
  MappingList.prototype.add = function MappingList_add(aMapping) {
    var mapping;
    if (generatedPositionAfter(this._last, aMapping)) {
      this._last = aMapping;
      this._array.push(aMapping);
    } else {
      this._sorted = false;
      this._array.push(aMapping);
    }
  };

  /**
   * Returns the flat, sorted array of mappings. The mappings are sorted by
   * generated position.
   *
   * WARNING: This method returns internal data without copying, for
   * performance. The return value must NOT be mutated, and should be treated as
   * an immutable borrow. If you want to take ownership, you must make your own
   * copy.
   */
  MappingList.prototype.toArray = function MappingList_toArray() {
    if (!this._sorted) {
      this._array.sort(util.compareByGeneratedPositionsInflated);
      this._sorted = true;
    }
    return this._array;
  };

  exports.MappingList = MappingList;

});

},{"./util":43,"amdefine":1}],39:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  // It turns out that some (most?) JavaScript engines don't self-host
  // `Array.prototype.sort`. This makes sense because C++ will likely remain
  // faster than JS when doing raw CPU-intensive sorting. However, when using a
  // custom comparator function, calling back and forth between the VM's C++ and
  // JIT'd JS is rather slow *and* loses JIT type information, resulting in
  // worse generated code for the comparator function than would be optimal. In
  // fact, when sorting with a comparator, these costs outweigh the benefits of
  // sorting in C++. By using our own JS-implemented Quick Sort (below), we get
  // a ~3500ms mean speed-up in `bench/bench.html`.

  /**
   * Swap the elements indexed by `x` and `y` in the array `ary`.
   *
   * @param {Array} ary
   *        The array.
   * @param {Number} x
   *        The index of the first item.
   * @param {Number} y
   *        The index of the second item.
   */
  function swap(ary, x, y) {
    var temp = ary[x];
    ary[x] = ary[y];
    ary[y] = temp;
  }

  /**
   * Returns a random integer within the range `low .. high` inclusive.
   *
   * @param {Number} low
   *        The lower bound on the range.
   * @param {Number} high
   *        The upper bound on the range.
   */
  function randomIntInRange(low, high) {
    return Math.round(low + (Math.random() * (high - low)));
  }

  /**
   * The Quick Sort algorithm.
   *
   * @param {Array} ary
   *        An array to sort.
   * @param {function} comparator
   *        Function to use to compare two items.
   * @param {Number} p
   *        Start index of the array
   * @param {Number} r
   *        End index of the array
   */
  function doQuickSort(ary, comparator, p, r) {
    // If our lower bound is less than our upper bound, we (1) partition the
    // array into two pieces and (2) recurse on each half. If it is not, this is
    // the empty array and our base case.

    if (p < r) {
      // (1) Partitioning.
      //
      // The partitioning chooses a pivot between `p` and `r` and moves all
      // elements that are less than or equal to the pivot to the before it, and
      // all the elements that are greater than it after it. The effect is that
      // once partition is done, the pivot is in the exact place it will be when
      // the array is put in sorted order, and it will not need to be moved
      // again. This runs in O(n) time.

      // Always choose a random pivot so that an input array which is reverse
      // sorted does not cause O(n^2) running time.
      var pivotIndex = randomIntInRange(p, r);
      var i = p - 1;

      swap(ary, pivotIndex, r);
      var pivot = ary[r];

      // Immediately after `j` is incremented in this loop, the following hold
      // true:
      //
      //   * Every element in `ary[p .. i]` is less than or equal to the pivot.
      //
      //   * Every element in `ary[i+1 .. j-1]` is greater than the pivot.
      for (var j = p; j < r; j++) {
        if (comparator(ary[j], pivot) <= 0) {
          i += 1;
          swap(ary, i, j);
        }
      }

      swap(ary, i + 1, j);
      var q = i + 1;

      // (2) Recurse on each half.

      doQuickSort(ary, comparator, p, q - 1);
      doQuickSort(ary, comparator, q + 1, r);
    }
  }

  /**
   * Sort the given array in-place with the given comparator function.
   *
   * @param {Array} ary
   *        An array to sort.
   * @param {function} comparator
   *        Function to use to compare two items.
   */
  exports.quickSort = function (ary, comparator) {
    doQuickSort(ary, comparator, 0, ary.length - 1);
  };

});

},{"amdefine":1}],40:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');
  var binarySearch = require('./binary-search');
  var ArraySet = require('./array-set').ArraySet;
  var base64VLQ = require('./base64-vlq');
  var quickSort = require('./quick-sort').quickSort;

  function SourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    return sourceMap.sections != null
      ? new IndexedSourceMapConsumer(sourceMap)
      : new BasicSourceMapConsumer(sourceMap);
  }

  SourceMapConsumer.fromSourceMap = function(aSourceMap) {
    return BasicSourceMapConsumer.fromSourceMap(aSourceMap);
  }

  /**
   * The version of the source mapping spec that we are consuming.
   */
  SourceMapConsumer.prototype._version = 3;

  // `__generatedMappings` and `__originalMappings` are arrays that hold the
  // parsed mapping coordinates from the source map's "mappings" attribute. They
  // are lazily instantiated, accessed via the `_generatedMappings` and
  // `_originalMappings` getters respectively, and we only parse the mappings
  // and create these arrays once queried for a source location. We jump through
  // these hoops because there can be many thousands of mappings, and parsing
  // them is expensive, so we only want to do it if we must.
  //
  // Each object in the arrays is of the form:
  //
  //     {
  //       generatedLine: The line number in the generated code,
  //       generatedColumn: The column number in the generated code,
  //       source: The path to the original source file that generated this
  //               chunk of code,
  //       originalLine: The line number in the original source that
  //                     corresponds to this chunk of generated code,
  //       originalColumn: The column number in the original source that
  //                       corresponds to this chunk of generated code,
  //       name: The name of the original symbol which generated this chunk of
  //             code.
  //     }
  //
  // All properties except for `generatedLine` and `generatedColumn` can be
  // `null`.
  //
  // `_generatedMappings` is ordered by the generated positions.
  //
  // `_originalMappings` is ordered by the original positions.

  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
    get: function () {
      if (!this.__generatedMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__generatedMappings;
    }
  });

  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
    get: function () {
      if (!this.__originalMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__originalMappings;
    }
  });

  SourceMapConsumer.prototype._charIsMappingSeparator =
    function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
      var c = aStr.charAt(index);
      return c === ";" || c === ",";
    };

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  SourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      throw new Error("Subclasses must implement _parseMappings");
    };

  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;

  SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
  SourceMapConsumer.LEAST_UPPER_BOUND = 2;

  /**
   * Iterate over each mapping between an original source/line/column and a
   * generated line/column in this source map.
   *
   * @param Function aCallback
   *        The function that is called with each mapping.
   * @param Object aContext
   *        Optional. If specified, this object will be the value of `this` every
   *        time that `aCallback` is called.
   * @param aOrder
   *        Either `SourceMapConsumer.GENERATED_ORDER` or
   *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
   *        iterate over the mappings sorted by the generated file's line/column
   *        order or the original's source/line/column order, respectively. Defaults to
   *        `SourceMapConsumer.GENERATED_ORDER`.
   */
  SourceMapConsumer.prototype.eachMapping =
    function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
      var context = aContext || null;
      var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

      var mappings;
      switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
      }

      var sourceRoot = this.sourceRoot;
      mappings.map(function (mapping) {
        var source = mapping.source === null ? null : this._sources.at(mapping.source);
        if (source != null && sourceRoot != null) {
          source = util.join(sourceRoot, source);
        }
        return {
          source: source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: mapping.name === null ? null : this._names.at(mapping.name)
        };
      }, this).forEach(aCallback, context);
    };

  /**
   * Returns all generated line and column information for the original source,
   * line, and column provided. If no column is provided, returns all mappings
   * corresponding to a either the line we are searching for or the next
   * closest line that has any mappings. Otherwise, returns all mappings
   * corresponding to the given line and either the column we are searching for
   * or the next closest column that has any offsets.
   *
   * The only argument is an object with the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: Optional. the column number in the original source.
   *
   * and an array of objects is returned, each with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  SourceMapConsumer.prototype.allGeneratedPositionsFor =
    function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
      var line = util.getArg(aArgs, 'line');

      // When there is no exact match, BasicSourceMapConsumer.prototype._findMapping
      // returns the index of the closest mapping less than the needle. By
      // setting needle.originalColumn to 0, we thus find the last mapping for
      // the given line, provided such a mapping exists.
      var needle = {
        source: util.getArg(aArgs, 'source'),
        originalLine: line,
        originalColumn: util.getArg(aArgs, 'column', 0)
      };

      if (this.sourceRoot != null) {
        needle.source = util.relative(this.sourceRoot, needle.source);
      }
      if (!this._sources.has(needle.source)) {
        return [];
      }
      needle.source = this._sources.indexOf(needle.source);

      var mappings = [];

      var index = this._findMapping(needle,
                                    this._originalMappings,
                                    "originalLine",
                                    "originalColumn",
                                    util.compareByOriginalPositions,
                                    binarySearch.LEAST_UPPER_BOUND);
      if (index >= 0) {
        var mapping = this._originalMappings[index];

        if (aArgs.column === undefined) {
          var originalLine = mapping.originalLine;

          // Iterate until either we run out of mappings, or we run into
          // a mapping for a different line than the one we found. Since
          // mappings are sorted, this is guaranteed to find all mappings for
          // the line we found.
          while (mapping && mapping.originalLine === originalLine) {
            mappings.push({
              line: util.getArg(mapping, 'generatedLine', null),
              column: util.getArg(mapping, 'generatedColumn', null),
              lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
            });

            mapping = this._originalMappings[++index];
          }
        } else {
          var originalColumn = mapping.originalColumn;

          // Iterate until either we run out of mappings, or we run into
          // a mapping for a different line than the one we were searching for.
          // Since mappings are sorted, this is guaranteed to find all mappings for
          // the line we are searching for.
          while (mapping &&
                 mapping.originalLine === line &&
                 mapping.originalColumn == originalColumn) {
            mappings.push({
              line: util.getArg(mapping, 'generatedLine', null),
              column: util.getArg(mapping, 'generatedColumn', null),
              lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
            });

            mapping = this._originalMappings[++index];
          }
        }
      }

      return mappings;
    };

  exports.SourceMapConsumer = SourceMapConsumer;

  /**
   * A BasicSourceMapConsumer instance represents a parsed source map which we can
   * query for information about the original file positions by giving it a file
   * position in the generated source.
   *
   * The only parameter is the raw source map (either as a JSON string, or
   * already parsed to an object). According to the spec, source maps have the
   * following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - sources: An array of URLs to the original source files.
   *   - names: An array of identifiers which can be referrenced by individual mappings.
   *   - sourceRoot: Optional. The URL root from which all sources are relative.
   *   - sourcesContent: Optional. An array of contents of the original source files.
   *   - mappings: A string of base64 VLQs which contain the actual mappings.
   *   - file: Optional. The generated file this source map is associated with.
   *
   * Here is an example source map, taken from the source map spec[0]:
   *
   *     {
   *       version : 3,
   *       file: "out.js",
   *       sourceRoot : "",
   *       sources: ["foo.js", "bar.js"],
   *       names: ["src", "maps", "are", "fun"],
   *       mappings: "AA,AB;;ABCDE;"
   *     }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
   */
  function BasicSourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sources = util.getArg(sourceMap, 'sources');
    // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
    // requires the array) to play nice here.
    var names = util.getArg(sourceMap, 'names', []);
    var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
    var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
    var mappings = util.getArg(sourceMap, 'mappings');
    var file = util.getArg(sourceMap, 'file', null);

    // Once again, Sass deviates from the spec and supplies the version as a
    // string rather than a number, so we use loose equality checking here.
    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    // Some source maps produce relative source paths like "./foo.js" instead of
    // "foo.js".  Normalize these first so that future comparisons will succeed.
    // See bugzil.la/1090768.
    sources = sources.map(util.normalize);

    // Pass `true` below to allow duplicate names and sources. While source maps
    // are intended to be compressed and deduplicated, the TypeScript compiler
    // sometimes generates source maps with duplicates in them. See Github issue
    // #72 and bugzil.la/889492.
    this._names = ArraySet.fromArray(names, true);
    this._sources = ArraySet.fromArray(sources, true);

    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this.file = file;
  }

  BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;

  /**
   * Create a BasicSourceMapConsumer from a SourceMapGenerator.
   *
   * @param SourceMapGenerator aSourceMap
   *        The source map that will be consumed.
   * @returns BasicSourceMapConsumer
   */
  BasicSourceMapConsumer.fromSourceMap =
    function SourceMapConsumer_fromSourceMap(aSourceMap) {
      var smc = Object.create(BasicSourceMapConsumer.prototype);

      var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
      var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
      smc.sourceRoot = aSourceMap._sourceRoot;
      smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                              smc.sourceRoot);
      smc.file = aSourceMap._file;

      // Because we are modifying the entries (by converting string sources and
      // names to indices into the sources and names ArraySets), we have to make
      // a copy of the entry or else bad things happen. Shared mutable state
      // strikes again! See github issue #191.

      var generatedMappings = aSourceMap._mappings.toArray().slice();
      var destGeneratedMappings = smc.__generatedMappings = [];
      var destOriginalMappings = smc.__originalMappings = [];

      for (var i = 0, length = generatedMappings.length; i < length; i++) {
        var srcMapping = generatedMappings[i];
        var destMapping = new Mapping;
        destMapping.generatedLine = srcMapping.generatedLine;
        destMapping.generatedColumn = srcMapping.generatedColumn;

        if (srcMapping.source) {
          destMapping.source = sources.indexOf(srcMapping.source);
          destMapping.originalLine = srcMapping.originalLine;
          destMapping.originalColumn = srcMapping.originalColumn;

          if (srcMapping.name) {
            destMapping.name = names.indexOf(srcMapping.name);
          }

          destOriginalMappings.push(destMapping);
        }

        destGeneratedMappings.push(destMapping);
      }

      quickSort(smc.__originalMappings, util.compareByOriginalPositions);

      return smc;
    };

  /**
   * The version of the source mapping spec that we are consuming.
   */
  BasicSourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(BasicSourceMapConsumer.prototype, 'sources', {
    get: function () {
      return this._sources.toArray().map(function (s) {
        return this.sourceRoot != null ? util.join(this.sourceRoot, s) : s;
      }, this);
    }
  });

  /**
   * Provide the JIT with a nice shape / hidden class.
   */
  function Mapping() {
    this.generatedLine = 0;
    this.generatedColumn = 0;
    this.source = null;
    this.originalLine = null;
    this.originalColumn = null;
    this.name = null;
  }

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  BasicSourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      var generatedLine = 1;
      var previousGeneratedColumn = 0;
      var previousOriginalLine = 0;
      var previousOriginalColumn = 0;
      var previousSource = 0;
      var previousName = 0;
      var length = aStr.length;
      var index = 0;
      var cachedSegments = {};
      var temp = {};
      var originalMappings = [];
      var generatedMappings = [];
      var mapping, str, segment, end, value;

      while (index < length) {
        if (aStr.charAt(index) === ';') {
          generatedLine++;
          index++;
          previousGeneratedColumn = 0;
        }
        else if (aStr.charAt(index) === ',') {
          index++;
        }
        else {
          mapping = new Mapping();
          mapping.generatedLine = generatedLine;

          // Because each offset is encoded relative to the previous one,
          // many segments often have the same encoding. We can exploit this
          // fact by caching the parsed variable length fields of each segment,
          // allowing us to avoid a second parse if we encounter the same
          // segment again.
          for (end = index; end < length; end++) {
            if (this._charIsMappingSeparator(aStr, end)) {
              break;
            }
          }
          str = aStr.slice(index, end);

          segment = cachedSegments[str];
          if (segment) {
            index += str.length;
          } else {
            segment = [];
            while (index < end) {
              base64VLQ.decode(aStr, index, temp);
              value = temp.value;
              index = temp.rest;
              segment.push(value);
            }

            if (segment.length === 2) {
              throw new Error('Found a source, but no line and column');
            }

            if (segment.length === 3) {
              throw new Error('Found a source and line, but no column');
            }

            cachedSegments[str] = segment;
          }

          // Generated column.
          mapping.generatedColumn = previousGeneratedColumn + segment[0];
          previousGeneratedColumn = mapping.generatedColumn;

          if (segment.length > 1) {
            // Original source.
            mapping.source = previousSource + segment[1];
            previousSource += segment[1];

            // Original line.
            mapping.originalLine = previousOriginalLine + segment[2];
            previousOriginalLine = mapping.originalLine;
            // Lines are stored 0-based
            mapping.originalLine += 1;

            // Original column.
            mapping.originalColumn = previousOriginalColumn + segment[3];
            previousOriginalColumn = mapping.originalColumn;

            if (segment.length > 4) {
              // Original name.
              mapping.name = previousName + segment[4];
              previousName += segment[4];
            }
          }

          generatedMappings.push(mapping);
          if (typeof mapping.originalLine === 'number') {
            originalMappings.push(mapping);
          }
        }
      }

      quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
      this.__generatedMappings = generatedMappings;

      quickSort(originalMappings, util.compareByOriginalPositions);
      this.__originalMappings = originalMappings;
    };

  /**
   * Find the mapping that best matches the hypothetical "needle" mapping that
   * we are searching for in the given "haystack" of mappings.
   */
  BasicSourceMapConsumer.prototype._findMapping =
    function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                           aColumnName, aComparator, aBias) {
      // To return the position we are searching for, we must first find the
      // mapping for the given position and then return the opposite position it
      // points to. Because the mappings are sorted, we can use binary search to
      // find the best mapping.

      if (aNeedle[aLineName] <= 0) {
        throw new TypeError('Line must be greater than or equal to 1, got '
                            + aNeedle[aLineName]);
      }
      if (aNeedle[aColumnName] < 0) {
        throw new TypeError('Column must be greater than or equal to 0, got '
                            + aNeedle[aColumnName]);
      }

      return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
    };

  /**
   * Compute the last column for each generated mapping. The last column is
   * inclusive.
   */
  BasicSourceMapConsumer.prototype.computeColumnSpans =
    function SourceMapConsumer_computeColumnSpans() {
      for (var index = 0; index < this._generatedMappings.length; ++index) {
        var mapping = this._generatedMappings[index];

        // Mappings do not contain a field for the last generated columnt. We
        // can come up with an optimistic estimate, however, by assuming that
        // mappings are contiguous (i.e. given two consecutive mappings, the
        // first mapping ends where the second one starts).
        if (index + 1 < this._generatedMappings.length) {
          var nextMapping = this._generatedMappings[index + 1];

          if (mapping.generatedLine === nextMapping.generatedLine) {
            mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
            continue;
          }
        }

        // The last mapping for each line spans the entire line.
        mapping.lastGeneratedColumn = Infinity;
      }
    };

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
   *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  BasicSourceMapConsumer.prototype.originalPositionFor =
    function SourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      var index = this._findMapping(
        needle,
        this._generatedMappings,
        "generatedLine",
        "generatedColumn",
        util.compareByGeneratedPositionsDeflated,
        util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
      );

      if (index >= 0) {
        var mapping = this._generatedMappings[index];

        if (mapping.generatedLine === needle.generatedLine) {
          var source = util.getArg(mapping, 'source', null);
          if (source !== null) {
            source = this._sources.at(source);
            if (this.sourceRoot != null) {
              source = util.join(this.sourceRoot, source);
            }
          }
          var name = util.getArg(mapping, 'name', null);
          if (name !== null) {
            name = this._names.at(name);
          }
          return {
            source: source,
            line: util.getArg(mapping, 'originalLine', null),
            column: util.getArg(mapping, 'originalColumn', null),
            name: name
          };
        }
      }

      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    };

  /**
   * Return true if we have the source content for every source in the source
   * map, false otherwise.
   */
  BasicSourceMapConsumer.prototype.hasContentsOfAllSources =
    function BasicSourceMapConsumer_hasContentsOfAllSources() {
      if (!this.sourcesContent) {
        return false;
      }
      return this.sourcesContent.length >= this._sources.size() &&
        !this.sourcesContent.some(function (sc) { return sc == null; });
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * availible.
   */
  BasicSourceMapConsumer.prototype.sourceContentFor =
    function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
      if (!this.sourcesContent) {
        return null;
      }

      if (this.sourceRoot != null) {
        aSource = util.relative(this.sourceRoot, aSource);
      }

      if (this._sources.has(aSource)) {
        return this.sourcesContent[this._sources.indexOf(aSource)];
      }

      var url;
      if (this.sourceRoot != null
          && (url = util.urlParse(this.sourceRoot))) {
        // XXX: file:// URIs and absolute paths lead to unexpected behavior for
        // many users. We can help them out when they expect file:// URIs to
        // behave like it would if they were running a local HTTP server. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
        var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
        if (url.scheme == "file"
            && this._sources.has(fileUriAbsPath)) {
          return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
        }

        if ((!url.path || url.path == "/")
            && this._sources.has("/" + aSource)) {
          return this.sourcesContent[this._sources.indexOf("/" + aSource)];
        }
      }

      // This function is used recursively from
      // IndexedSourceMapConsumer.prototype.sourceContentFor. In that case, we
      // don't want to throw if we can't find the source - we just want to
      // return null, so we provide a flag to exit gracefully.
      if (nullOnMissing) {
        return null;
      }
      else {
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      }
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
   *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  BasicSourceMapConsumer.prototype.generatedPositionFor =
    function SourceMapConsumer_generatedPositionFor(aArgs) {
      var source = util.getArg(aArgs, 'source');
      if (this.sourceRoot != null) {
        source = util.relative(this.sourceRoot, source);
      }
      if (!this._sources.has(source)) {
        return {
          line: null,
          column: null,
          lastColumn: null
        };
      }
      source = this._sources.indexOf(source);

      var needle = {
        source: source,
        originalLine: util.getArg(aArgs, 'line'),
        originalColumn: util.getArg(aArgs, 'column')
      };

      var index = this._findMapping(
        needle,
        this._originalMappings,
        "originalLine",
        "originalColumn",
        util.compareByOriginalPositions,
        util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
      );

      if (index >= 0) {
        var mapping = this._originalMappings[index];

        if (mapping.source === needle.source) {
          return {
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          };
        }
      }

      return {
        line: null,
        column: null,
        lastColumn: null
      };
    };

  exports.BasicSourceMapConsumer = BasicSourceMapConsumer;

  /**
   * An IndexedSourceMapConsumer instance represents a parsed source map which
   * we can query for information. It differs from BasicSourceMapConsumer in
   * that it takes "indexed" source maps (i.e. ones with a "sections" field) as
   * input.
   *
   * The only parameter is a raw source map (either as a JSON string, or already
   * parsed to an object). According to the spec for indexed source maps, they
   * have the following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - file: Optional. The generated file this source map is associated with.
   *   - sections: A list of section definitions.
   *
   * Each value under the "sections" field has two fields:
   *   - offset: The offset into the original specified at which this section
   *       begins to apply, defined as an object with a "line" and "column"
   *       field.
   *   - map: A source map definition. This source map could also be indexed,
   *       but doesn't have to be.
   *
   * Instead of the "map" field, it's also possible to have a "url" field
   * specifying a URL to retrieve a source map from, but that's currently
   * unsupported.
   *
   * Here's an example source map, taken from the source map spec[0], but
   * modified to omit a section which uses the "url" field.
   *
   *  {
   *    version : 3,
   *    file: "app.js",
   *    sections: [{
   *      offset: {line:100, column:10},
   *      map: {
   *        version : 3,
   *        file: "section.js",
   *        sources: ["foo.js", "bar.js"],
   *        names: ["src", "maps", "are", "fun"],
   *        mappings: "AAAA,E;;ABCDE;"
   *      }
   *    }],
   *  }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
   */
  function IndexedSourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sections = util.getArg(sourceMap, 'sections');

    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    this._sources = new ArraySet();
    this._names = new ArraySet();

    var lastOffset = {
      line: -1,
      column: 0
    };
    this._sections = sections.map(function (s) {
      if (s.url) {
        // The url field will require support for asynchronicity.
        // See https://github.com/mozilla/source-map/issues/16
        throw new Error('Support for url field in sections not implemented.');
      }
      var offset = util.getArg(s, 'offset');
      var offsetLine = util.getArg(offset, 'line');
      var offsetColumn = util.getArg(offset, 'column');

      if (offsetLine < lastOffset.line ||
          (offsetLine === lastOffset.line && offsetColumn < lastOffset.column)) {
        throw new Error('Section offsets must be ordered and non-overlapping.');
      }
      lastOffset = offset;

      return {
        generatedOffset: {
          // The offset fields are 0-based, but we use 1-based indices when
          // encoding/decoding from VLQ.
          generatedLine: offsetLine + 1,
          generatedColumn: offsetColumn + 1
        },
        consumer: new SourceMapConsumer(util.getArg(s, 'map'))
      }
    });
  }

  IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;

  /**
   * The version of the source mapping spec that we are consuming.
   */
  IndexedSourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(IndexedSourceMapConsumer.prototype, 'sources', {
    get: function () {
      var sources = [];
      for (var i = 0; i < this._sections.length; i++) {
        for (var j = 0; j < this._sections[i].consumer.sources.length; j++) {
          sources.push(this._sections[i].consumer.sources[j]);
        }
      };
      return sources;
    }
  });

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  IndexedSourceMapConsumer.prototype.originalPositionFor =
    function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      // Find the section containing the generated position we're trying to map
      // to an original position.
      var sectionIndex = binarySearch.search(needle, this._sections,
        function(needle, section) {
          var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
          if (cmp) {
            return cmp;
          }

          return (needle.generatedColumn -
                  section.generatedOffset.generatedColumn);
        });
      var section = this._sections[sectionIndex];

      if (!section) {
        return {
          source: null,
          line: null,
          column: null,
          name: null
        };
      }

      return section.consumer.originalPositionFor({
        line: needle.generatedLine -
          (section.generatedOffset.generatedLine - 1),
        column: needle.generatedColumn -
          (section.generatedOffset.generatedLine === needle.generatedLine
           ? section.generatedOffset.generatedColumn - 1
           : 0),
        bias: aArgs.bias
      });
    };

  /**
   * Return true if we have the source content for every source in the source
   * map, false otherwise.
   */
  IndexedSourceMapConsumer.prototype.hasContentsOfAllSources =
    function IndexedSourceMapConsumer_hasContentsOfAllSources() {
      return this._sections.every(function (s) {
        return s.consumer.hasContentsOfAllSources();
      });
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * available.
   */
  IndexedSourceMapConsumer.prototype.sourceContentFor =
    function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
      for (var i = 0; i < this._sections.length; i++) {
        var section = this._sections[i];

        var content = section.consumer.sourceContentFor(aSource, true);
        if (content) {
          return content;
        }
      }
      if (nullOnMissing) {
        return null;
      }
      else {
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      }
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  IndexedSourceMapConsumer.prototype.generatedPositionFor =
    function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
      for (var i = 0; i < this._sections.length; i++) {
        var section = this._sections[i];

        // Only consider this section if the requested source is in the list of
        // sources of the consumer.
        if (section.consumer.sources.indexOf(util.getArg(aArgs, 'source')) === -1) {
          continue;
        }
        var generatedPosition = section.consumer.generatedPositionFor(aArgs);
        if (generatedPosition) {
          var ret = {
            line: generatedPosition.line +
              (section.generatedOffset.generatedLine - 1),
            column: generatedPosition.column +
              (section.generatedOffset.generatedLine === generatedPosition.line
               ? section.generatedOffset.generatedColumn - 1
               : 0)
          };
          return ret;
        }
      }

      return {
        line: null,
        column: null
      };
    };

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  IndexedSourceMapConsumer.prototype._parseMappings =
    function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      this.__generatedMappings = [];
      this.__originalMappings = [];
      for (var i = 0; i < this._sections.length; i++) {
        var section = this._sections[i];
        var sectionMappings = section.consumer._generatedMappings;
        for (var j = 0; j < sectionMappings.length; j++) {
          var mapping = sectionMappings[i];

          var source = section.consumer._sources.at(mapping.source);
          if (section.consumer.sourceRoot !== null) {
            source = util.join(section.consumer.sourceRoot, source);
          }
          this._sources.add(source);
          source = this._sources.indexOf(source);

          var name = section.consumer._names.at(mapping.name);
          this._names.add(name);
          name = this._names.indexOf(name);

          // The mappings coming from the consumer for the section have
          // generated positions relative to the start of the section, so we
          // need to offset them to be relative to the start of the concatenated
          // generated file.
          var adjustedMapping = {
            source: source,
            generatedLine: mapping.generatedLine +
              (section.generatedOffset.generatedLine - 1),
            generatedColumn: mapping.column +
              (section.generatedOffset.generatedLine === mapping.generatedLine)
              ? section.generatedOffset.generatedColumn - 1
              : 0,
            originalLine: mapping.originalLine,
            originalColumn: mapping.originalColumn,
            name: name
          };

          this.__generatedMappings.push(adjustedMapping);
          if (typeof adjustedMapping.originalLine === 'number') {
            this.__originalMappings.push(adjustedMapping);
          }
        };
      };

      quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
      quickSort(this.__originalMappings, util.compareByOriginalPositions);
    };

  exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;

});

},{"./array-set":34,"./base64-vlq":35,"./binary-search":37,"./quick-sort":39,"./util":43,"amdefine":1}],41:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64VLQ = require('./base64-vlq');
  var util = require('./util');
  var ArraySet = require('./array-set').ArraySet;
  var MappingList = require('./mapping-list').MappingList;

  /**
   * An instance of the SourceMapGenerator represents a source map which is
   * being built incrementally. You may pass an object with the following
   * properties:
   *
   *   - file: The filename of the generated source.
   *   - sourceRoot: A root for all relative URLs in this source map.
   */
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util.getArg(aArgs, 'file', null);
    this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
    this._skipValidation = util.getArg(aArgs, 'skipValidation', false);
    this._sources = new ArraySet();
    this._names = new ArraySet();
    this._mappings = new MappingList();
    this._sourcesContents = null;
  }

  SourceMapGenerator.prototype._version = 3;

  /**
   * Creates a new SourceMapGenerator based on a SourceMapConsumer
   *
   * @param aSourceMapConsumer The SourceMap.
   */
  SourceMapGenerator.fromSourceMap =
    function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator({
        file: aSourceMapConsumer.file,
        sourceRoot: sourceRoot
      });
      aSourceMapConsumer.eachMapping(function (mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };

        if (mapping.source != null) {
          newMapping.source = mapping.source;
          if (sourceRoot != null) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }

          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };

          if (mapping.name != null) {
            newMapping.name = mapping.name;
          }
        }

        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  SourceMapGenerator.prototype.addMapping =
    function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, 'generated');
      var original = util.getArg(aArgs, 'original', null);
      var source = util.getArg(aArgs, 'source', null);
      var name = util.getArg(aArgs, 'name', null);

      if (!this._skipValidation) {
        this._validateMapping(generated, original, source, name);
      }

      if (source != null && !this._sources.has(source)) {
        this._sources.add(source);
      }

      if (name != null && !this._names.has(name)) {
        this._names.add(name);
      }

      this._mappings.add({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source: source,
        name: name
      });
    };

  /**
   * Set the source content for a source file.
   */
  SourceMapGenerator.prototype.setSourceContent =
    function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot != null) {
        source = util.relative(this._sourceRoot, source);
      }

      if (aSourceContent != null) {
        // Add the source content to the _sourcesContents map.
        // Create a new _sourcesContents map if the property is null.
        if (!this._sourcesContents) {
          this._sourcesContents = {};
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else if (this._sourcesContents) {
        // Remove the source file from the _sourcesContents map.
        // If the _sourcesContents map is empty, set the property to null.
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };

  /**
   * Applies the mappings of a sub-source-map for a specific source file to the
   * source map being generated. Each mapping to the supplied source file is
   * rewritten using the supplied source map. Note: The resolution for the
   * resulting mappings is the minimium of this map and the supplied map.
   *
   * @param aSourceMapConsumer The source map to be applied.
   * @param aSourceFile Optional. The filename of the source file.
   *        If omitted, SourceMapConsumer's file property will be used.
   * @param aSourceMapPath Optional. The dirname of the path to the source map
   *        to be applied. If relative, it is relative to the SourceMapConsumer.
   *        This parameter is needed when the two source maps aren't in the same
   *        directory, and the source map to be applied contains relative source
   *        paths. If so, those relative source paths need to be rewritten
   *        relative to the SourceMapGenerator.
   */
  SourceMapGenerator.prototype.applySourceMap =
    function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
      var sourceFile = aSourceFile;
      // If aSourceFile is omitted, we will use the file property of the SourceMap
      if (aSourceFile == null) {
        if (aSourceMapConsumer.file == null) {
          throw new Error(
            'SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' +
            'or the source map\'s "file" property. Both were omitted.'
          );
        }
        sourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      // Make "sourceFile" relative if an absolute Url is passed.
      if (sourceRoot != null) {
        sourceFile = util.relative(sourceRoot, sourceFile);
      }
      // Applying the SourceMap can add and remove items from the sources and
      // the names array.
      var newSources = new ArraySet();
      var newNames = new ArraySet();

      // Find mappings for the "sourceFile"
      this._mappings.unsortedForEach(function (mapping) {
        if (mapping.source === sourceFile && mapping.originalLine != null) {
          // Check if it can be mapped by the source map, then update the mapping.
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source != null) {
            // Copy mapping
            mapping.source = original.source;
            if (aSourceMapPath != null) {
              mapping.source = util.join(aSourceMapPath, mapping.source)
            }
            if (sourceRoot != null) {
              mapping.source = util.relative(sourceRoot, mapping.source);
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name != null) {
              mapping.name = original.name;
            }
          }
        }

        var source = mapping.source;
        if (source != null && !newSources.has(source)) {
          newSources.add(source);
        }

        var name = mapping.name;
        if (name != null && !newNames.has(name)) {
          newNames.add(name);
        }

      }, this);
      this._sources = newSources;
      this._names = newNames;

      // Copy sourcesContents of applied map.
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aSourceMapPath != null) {
            sourceFile = util.join(aSourceMapPath, sourceFile);
          }
          if (sourceRoot != null) {
            sourceFile = util.relative(sourceRoot, sourceFile);
          }
          this.setSourceContent(sourceFile, content);
        }
      }, this);
    };

  /**
   * A mapping can have one of the three levels of data:
   *
   *   1. Just the generated position.
   *   2. The Generated position, original position, and original source.
   *   3. Generated and original position, original source, as well as a name
   *      token.
   *
   * To maintain consistency, we validate that any new mapping being added falls
   * in to one of these categories.
   */
  SourceMapGenerator.prototype._validateMapping =
    function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                                aName) {
      if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
          && aGenerated.line > 0 && aGenerated.column >= 0
          && !aOriginal && !aSource && !aName) {
        // Case 1.
        return;
      }
      else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
               && aOriginal && 'line' in aOriginal && 'column' in aOriginal
               && aGenerated.line > 0 && aGenerated.column >= 0
               && aOriginal.line > 0 && aOriginal.column >= 0
               && aSource) {
        // Cases 2 and 3.
        return;
      }
      else {
        throw new Error('Invalid mapping: ' + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        }));
      }
    };

  /**
   * Serialize the accumulated mappings in to the stream of base 64 VLQs
   * specified by the source map format.
   */
  SourceMapGenerator.prototype._serializeMappings =
    function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = '';
      var mapping;

      var mappings = this._mappings.toArray();
      for (var i = 0, len = mappings.length; i < len; i++) {
        mapping = mappings[i];

        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            result += ';';
            previousGeneratedLine++;
          }
        }
        else {
          if (i > 0) {
            if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
              continue;
            }
            result += ',';
          }
        }

        result += base64VLQ.encode(mapping.generatedColumn
                                   - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;

        if (mapping.source != null) {
          result += base64VLQ.encode(this._sources.indexOf(mapping.source)
                                     - previousSource);
          previousSource = this._sources.indexOf(mapping.source);

          // lines are stored 0-based in SourceMap spec version 3
          result += base64VLQ.encode(mapping.originalLine - 1
                                     - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;

          result += base64VLQ.encode(mapping.originalColumn
                                     - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;

          if (mapping.name != null) {
            result += base64VLQ.encode(this._names.indexOf(mapping.name)
                                       - previousName);
            previousName = this._names.indexOf(mapping.name);
          }
        }
      }

      return result;
    };

  SourceMapGenerator.prototype._generateSourcesContent =
    function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function (source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot != null) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents,
                                                    key)
          ? this._sourcesContents[key]
          : null;
      }, this);
    };

  /**
   * Externalize the source map.
   */
  SourceMapGenerator.prototype.toJSON =
    function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._file != null) {
        map.file = this._file;
      }
      if (this._sourceRoot != null) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }

      return map;
    };

  /**
   * Render the source map being generated to a string.
   */
  SourceMapGenerator.prototype.toString =
    function SourceMapGenerator_toString() {
      return JSON.stringify(this.toJSON());
    };

  exports.SourceMapGenerator = SourceMapGenerator;

});

},{"./array-set":34,"./base64-vlq":35,"./mapping-list":38,"./util":43,"amdefine":1}],42:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
  var util = require('./util');

  // Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
  // operating systems these days (capturing the result).
  var REGEX_NEWLINE = /(\r?\n)/;

  // Newline character code for charCodeAt() comparisons
  var NEWLINE_CODE = 10;

  // Private symbol for identifying `SourceNode`s when multiple versions of
  // the source-map library are loaded. This MUST NOT CHANGE across
  // versions!
  var isSourceNode = "$$$isSourceNode$$$";

  /**
   * SourceNodes provide a way to abstract over interpolating/concatenating
   * snippets of generated JavaScript source code while maintaining the line and
   * column information associated with the original source code.
   *
   * @param aLine The original line number.
   * @param aColumn The original column number.
   * @param aSource The original source's filename.
   * @param aChunks Optional. An array of strings which are snippets of
   *        generated JS, or other SourceNodes.
   * @param aName The original identifier.
   */
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine == null ? null : aLine;
    this.column = aColumn == null ? null : aColumn;
    this.source = aSource == null ? null : aSource;
    this.name = aName == null ? null : aName;
    this[isSourceNode] = true;
    if (aChunks != null) this.add(aChunks);
  }

  /**
   * Creates a SourceNode from generated code and a SourceMapConsumer.
   *
   * @param aGeneratedCode The generated code
   * @param aSourceMapConsumer The SourceMap for the generated code
   * @param aRelativePath Optional. The path that relative sources in the
   *        SourceMapConsumer should be relative to.
   */
  SourceNode.fromStringWithSourceMap =
    function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
      // The SourceNode we want to fill with the generated code
      // and the SourceMap
      var node = new SourceNode();

      // All even indices of this array are one line of the generated code,
      // while all odd indices are the newlines between two adjacent lines
      // (since `REGEX_NEWLINE` captures its match).
      // Processed fragments are removed from this array, by calling `shiftNextLine`.
      var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
      var shiftNextLine = function() {
        var lineContents = remainingLines.shift();
        // The last line of a file might not have a newline.
        var newLine = remainingLines.shift() || "";
        return lineContents + newLine;
      };

      // We need to remember the position of "remainingLines"
      var lastGeneratedLine = 1, lastGeneratedColumn = 0;

      // The generate SourceNodes we need a code range.
      // To extract it current and last mapping is used.
      // Here we store the last mapping.
      var lastMapping = null;

      aSourceMapConsumer.eachMapping(function (mapping) {
        if (lastMapping !== null) {
          // We add the code from "lastMapping" to "mapping":
          // First check if there is a new line in between.
          if (lastGeneratedLine < mapping.generatedLine) {
            var code = "";
            // Associate first line with "lastMapping"
            addMappingWithCode(lastMapping, shiftNextLine());
            lastGeneratedLine++;
            lastGeneratedColumn = 0;
            // The remaining code is added without mapping
          } else {
            // There is no new line in between.
            // Associate the code between "lastGeneratedColumn" and
            // "mapping.generatedColumn" with "lastMapping"
            var nextLine = remainingLines[0];
            var code = nextLine.substr(0, mapping.generatedColumn -
                                          lastGeneratedColumn);
            remainingLines[0] = nextLine.substr(mapping.generatedColumn -
                                                lastGeneratedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
            addMappingWithCode(lastMapping, code);
            // No more remaining code, continue
            lastMapping = mapping;
            return;
          }
        }
        // We add the generated code until the first mapping
        // to the SourceNode without any mapping.
        // Each line is added as separate string.
        while (lastGeneratedLine < mapping.generatedLine) {
          node.add(shiftNextLine());
          lastGeneratedLine++;
        }
        if (lastGeneratedColumn < mapping.generatedColumn) {
          var nextLine = remainingLines[0];
          node.add(nextLine.substr(0, mapping.generatedColumn));
          remainingLines[0] = nextLine.substr(mapping.generatedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
        }
        lastMapping = mapping;
      }, this);
      // We have processed all mappings.
      if (remainingLines.length > 0) {
        if (lastMapping) {
          // Associate the remaining code in the current line with "lastMapping"
          addMappingWithCode(lastMapping, shiftNextLine());
        }
        // and add the remaining lines without any mapping
        node.add(remainingLines.join(""));
      }

      // Copy sourcesContent into SourceNode
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aRelativePath != null) {
            sourceFile = util.join(aRelativePath, sourceFile);
          }
          node.setSourceContent(sourceFile, content);
        }
      });

      return node;

      function addMappingWithCode(mapping, code) {
        if (mapping === null || mapping.source === undefined) {
          node.add(code);
        } else {
          var source = aRelativePath
            ? util.join(aRelativePath, mapping.source)
            : mapping.source;
          node.add(new SourceNode(mapping.originalLine,
                                  mapping.originalColumn,
                                  source,
                                  code,
                                  mapping.name));
        }
      }
    };

  /**
   * Add a chunk of generated JS to this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function (chunk) {
        this.add(chunk);
      }, this);
    }
    else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Add a chunk of generated JS to the beginning of this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length-1; i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    }
    else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Walk over the tree of JS snippets in this node and its children. The
   * walking function is called once for each snippet of JS and is passed that
   * snippet and the its original associated source's line/column location.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length; i < len; i++) {
      chunk = this.children[i];
      if (chunk[isSourceNode]) {
        chunk.walk(aFn);
      }
      else {
        if (chunk !== '') {
          aFn(chunk, { source: this.source,
                       line: this.line,
                       column: this.column,
                       name: this.name });
        }
      }
    }
  };

  /**
   * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
   * each of `this.children`.
   *
   * @param aSep The separator.
   */
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0; i < len-1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };

  /**
   * Call String.prototype.replace on the very right-most source snippet. Useful
   * for trimming whitespace from the end of a source node, etc.
   *
   * @param aPattern The pattern to replace.
   * @param aReplacement The thing to replace the pattern with.
   */
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild[isSourceNode]) {
      lastChild.replaceRight(aPattern, aReplacement);
    }
    else if (typeof lastChild === 'string') {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    }
    else {
      this.children.push(''.replace(aPattern, aReplacement));
    }
    return this;
  };

  /**
   * Set the source content for a source file. This will be added to the SourceMapGenerator
   * in the sourcesContent field.
   *
   * @param aSourceFile The filename of the source file
   * @param aSourceContent The content of the source file
   */
  SourceNode.prototype.setSourceContent =
    function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
      this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
    };

  /**
   * Walk over the tree of SourceNodes. The walking function is called for each
   * source file content and is passed the filename and source content.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walkSourceContents =
    function SourceNode_walkSourceContents(aFn) {
      for (var i = 0, len = this.children.length; i < len; i++) {
        if (this.children[i][isSourceNode]) {
          this.children[i].walkSourceContents(aFn);
        }
      }

      var sources = Object.keys(this.sourceContents);
      for (var i = 0, len = sources.length; i < len; i++) {
        aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
      }
    };

  /**
   * Return the string representation of this source node. Walks over the tree
   * and concatenates all the various snippets together to one string.
   */
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function (chunk) {
      str += chunk;
    });
    return str;
  };

  /**
   * Returns the string representation of this source node along with a source
   * map.
   */
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function (chunk, original) {
      generated.code += chunk;
      if (original.source !== null
          && original.line !== null
          && original.column !== null) {
        if(lastOriginalSource !== original.source
           || lastOriginalLine !== original.line
           || lastOriginalColumn !== original.column
           || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      for (var idx = 0, length = chunk.length; idx < length; idx++) {
        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
          generated.line++;
          generated.column = 0;
          // Mappings end at eol
          if (idx + 1 === length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column++;
        }
      }
    });
    this.walkSourceContents(function (sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });

    return { code: generated.code, map: map };
  };

  exports.SourceNode = SourceNode;

});

},{"./source-map-generator":41,"./util":43,"amdefine":1}],43:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * This is a helper function for getting values from parameter/options
   * objects.
   *
   * @param args The object we are extracting values from
   * @param name The name of the property we are getting.
   * @param defaultValue An optional value to return if the property is missing
   * from the object. If this is not specified and the property is missing, an
   * error will be thrown.
   */
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;

  var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
  var dataUrlRegexp = /^data:.+\,.+$/;

  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[2],
      host: match[3],
      port: match[4],
      path: match[5]
    };
  }
  exports.urlParse = urlParse;

  function urlGenerate(aParsedUrl) {
    var url = '';
    if (aParsedUrl.scheme) {
      url += aParsedUrl.scheme + ':';
    }
    url += '//';
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + '@';
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;

  /**
   * Normalizes a path, or the path portion of a URL:
   *
   * - Replaces consequtive slashes with one slash.
   * - Removes unnecessary '.' parts.
   * - Removes unnecessary '<dir>/..' parts.
   *
   * Based on code in the Node.js 'path' core module.
   *
   * @param aPath The path or url to normalize.
   */
  function normalize(aPath) {
    var path = aPath;
    var url = urlParse(aPath);
    if (url) {
      if (!url.path) {
        return aPath;
      }
      path = url.path;
    }
    var isAbsolute = (path.charAt(0) === '/');

    var parts = path.split(/\/+/);
    for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
      part = parts[i];
      if (part === '.') {
        parts.splice(i, 1);
      } else if (part === '..') {
        up++;
      } else if (up > 0) {
        if (part === '') {
          // The first part is blank if the path is absolute. Trying to go
          // above the root is a no-op. Therefore we can remove all '..' parts
          // directly after the root.
          parts.splice(i + 1, up);
          up = 0;
        } else {
          parts.splice(i, 2);
          up--;
        }
      }
    }
    path = parts.join('/');

    if (path === '') {
      path = isAbsolute ? '/' : '.';
    }

    if (url) {
      url.path = path;
      return urlGenerate(url);
    }
    return path;
  }
  exports.normalize = normalize;

  /**
   * Joins two paths/URLs.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be joined with the root.
   *
   * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
   *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
   *   first.
   * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
   *   is updated with the result and aRoot is returned. Otherwise the result
   *   is returned.
   *   - If aPath is absolute, the result is aPath.
   *   - Otherwise the two paths are joined with a slash.
   * - Joining for example 'http://' and 'www.example.com' is also supported.
   */
  function join(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }
    if (aPath === "") {
      aPath = ".";
    }
    var aPathUrl = urlParse(aPath);
    var aRootUrl = urlParse(aRoot);
    if (aRootUrl) {
      aRoot = aRootUrl.path || '/';
    }

    // `join(foo, '//www.example.org')`
    if (aPathUrl && !aPathUrl.scheme) {
      if (aRootUrl) {
        aPathUrl.scheme = aRootUrl.scheme;
      }
      return urlGenerate(aPathUrl);
    }

    if (aPathUrl || aPath.match(dataUrlRegexp)) {
      return aPath;
    }

    // `join('http://', 'www.example.com')`
    if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
      aRootUrl.host = aPath;
      return urlGenerate(aRootUrl);
    }

    var joined = aPath.charAt(0) === '/'
      ? aPath
      : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

    if (aRootUrl) {
      aRootUrl.path = joined;
      return urlGenerate(aRootUrl);
    }
    return joined;
  }
  exports.join = join;

  /**
   * Make a path relative to a URL or another path.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be made relative to aRoot.
   */
  function relative(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }

    aRoot = aRoot.replace(/\/$/, '');

    // It is possible for the path to be above the root. In this case, simply
    // checking whether the root is a prefix of the path won't work. Instead, we
    // need to remove components from the root one by one, until either we find
    // a prefix that fits, or we run out of components to remove.
    var level = 0;
    while (aPath.indexOf(aRoot + '/') !== 0) {
      var index = aRoot.lastIndexOf("/");
      if (index < 0) {
        return aPath;
      }

      // If the only part of the root that is left is the scheme (i.e. http://,
      // file:///, etc.), one or more slashes (/), or simply nothing at all, we
      // have exhausted all components, so the path is not relative to the root.
      aRoot = aRoot.slice(0, index);
      if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
        return aPath;
      }

      ++level;
    }

    // Make sure we add a "../" for each component we removed from the root.
    return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
  }
  exports.relative = relative;

  /**
   * Because behavior goes wacky when you set `__proto__` on objects, we
   * have to prefix all the strings in our set with an arbitrary character.
   *
   * See https://github.com/mozilla/source-map/pull/31 and
   * https://github.com/mozilla/source-map/issues/30
   *
   * @param String aStr
   */
  function toSetString(aStr) {
    return '$' + aStr;
  }
  exports.toSetString = toSetString;

  function fromSetString(aStr) {
    return aStr.substr(1);
  }
  exports.fromSetString = fromSetString;

  /**
   * Comparator between two mappings where the original positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same original source/line/column, but different generated
   * line and column the same. Useful when searching for a mapping with a
   * stubbed out mapping.
   */
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp = mappingA.source - mappingB.source;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0 || onlyCompareOriginal) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }

    return mappingA.name - mappingB.name;
  };
  exports.compareByOriginalPositions = compareByOriginalPositions;

  /**
   * Comparator between two mappings with deflated source and name indices where
   * the generated positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same generated line and column, but different
   * source/name/original line and column the same. Useful when searching for a
   * mapping with a stubbed out mapping.
   */
  function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0 || onlyCompareGenerated) {
      return cmp;
    }

    cmp = mappingA.source - mappingB.source;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }

    return mappingA.name - mappingB.name;
  };
  exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;

  function strcmp(aStr1, aStr2) {
    if (aStr1 === aStr2) {
      return 0;
    }

    if (aStr1 > aStr2) {
      return 1;
    }

    return -1;
  }

  /**
   * Comparator between two mappings with inflated source and name strings where
   * the generated positions are compared.
   */
  function compareByGeneratedPositionsInflated(mappingA, mappingB) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }

    return strcmp(mappingA.name, mappingB.name);
  };
  exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;

});

},{"amdefine":1}],44:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))

},{"_process":45}],45:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],46:[function(require,module,exports){
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

},{}],47:[function(require,module,exports){
module.exports = function() {
  const button = document.querySelector('#parse-it-button')

  if (button) {
    button.addEventListener('click', (e) => {
      const form = document.querySelector('#nlqform')

      if (form.checkValidity()) {
        // Do not submit form.
        e.preventDefault()
        location.href = `/grapheditor?query=${encodeURIComponent(form.query.value)}&target=${form.target.value}`
      } else {
        form.querySelector('#query')
          .focus()
      }
    })
  }
}

},{}],48:[function(require,module,exports){
const { updateConfig } = require('../update-sample-queries')

module.exports = function(config) {
  setTargetDisplay(config)
  setNlqFormTarget(config)
  setEndpoint(config)
  updateConfig(config)
}

function setTargetDisplay(config) {
  if (config['home']) {
    document.querySelector('#target-display')
      .innerHTML = `@<a href="${config['home']}">${config['name']}</a>`
  } else {
    document.querySelector('#target-display')
      .innerHTML = `@${config['name']}`
  }
}

function setNlqFormTarget(config) {
  // to setup target in NLQ form
  document.querySelector('#nlqform input[name="target"]')
    .value = config.name
}

function setEndpoint(config) {
  document.querySelector('#endpoint-url')
    .value = config.endpoint_url
  document.querySelector('#need-proxy')
    .value = (config.name === 'biogateway')
}

},{"../update-sample-queries":55}],49:[function(require,module,exports){
const getTargetConfig = require('../../../../get-target-config')
const applyConfig = require('./apply-config')
const setDictionaryUrl = require('./set-dictionary-url')

module.exports = function(target, editor = null) {
  getTargetConfig(target)
    .catch(() => console.log('Gateway error!'))
    .then((config) => {
      applyConfig(config)
      if (editor) {
        setDictionaryUrl(editor, config)
      }
    })
}

},{"../../../../get-target-config":56,"./apply-config":48,"./set-dictionary-url":51}],50:[function(require,module,exports){
const changeTarget = require('./change-target')
module.exports = function bindTargetChangeEventhandler(editor) {
  // add event listeners
  const selector = document.querySelector('#target')
  if(selector) {
    selector.addEventListener('change', (e) => changeTarget(e.target.value, editor))

    // initial target
    changeTarget(selector.value, editor)
  }
}

},{"./change-target":49}],51:[function(require,module,exports){
module.exports = function(editor, config) {
  const dicUrl = config.dictionary_url
  const predDicUrl = config.pred_dictionary_url
  editor.setDictionaryUrl(dicUrl, predDicUrl)
}

},{}],52:[function(require,module,exports){
const bindModeSwitchButtonEventhandler = require('../../bind-mode-switch-eventhandler')
const initSampleQueries = require('./init-sample-queries')
const bindParseItButtonEventhandler = require('./bind-parse-it-button-eventhandler')
const initGrpahEditor = require('./init-grpah-editor')
const bindTargetChangeEventhandler = require('./bind-target-change-eventhandler')

module.exports = function() {
  initSampleQueries()
  bindModeSwitchButtonEventhandler('')
  bindParseItButtonEventhandler()

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}

},{"../../bind-mode-switch-eventhandler":46,"./bind-parse-it-button-eventhandler":47,"./bind-target-change-eventhandler":50,"./init-grpah-editor":53,"./init-sample-queries":54}],53:[function(require,module,exports){
/* global graphEditor */
module.exports = function() {
  if (window.graphEditor) {
    const editor = graphEditor('/termfinder')

    // init graph
    editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp')
      .innerHTML))

    return editor
  }
}

},{}],54:[function(require,module,exports){
module.exports = function() {
  // Show or hide sample queries when the button is clicked.
  document.querySelector('#button-show-queries')
    .addEventListener('click', (e) => {
      e.stopPropagation()
      const element = document.querySelector('.examples')
      if (element) {
        element.classList.toggle('examples--hidden')
      }
    })

  // Hide sample queries when it is clicked.
  const queries = document.querySelector('.sample-queries')
  if (queries) {
    queries.addEventListener('click', () => {
      const element = document.querySelector('.examples')
      if (element) {
        element.classList.add('examples--hidden')
      }
    })
  }
}

},{}],55:[function(require,module,exports){
const handlebars = require('handlebars')

const template = handlebars.compile(`
  {{#each this}}
    <li><a href="{{href}}">{{query}}</a></li>
  {{/each}}
`)
const cache = {}

module.exports = {
  updateConfig(config) {
    cache.config = config
    update(cache.config, cache.readTimeout)
  },
  updateReadTimeout(readTimeout){
    cache.readTimeout = readTimeout
    update(cache.config, cache.readTimeout)
  }
}

function update(config, readTimeout) {
  const {
    name,
    sample_queries
  } = config
  const dom = document.querySelector('.sample-queries')

  if (sample_queries) {
    const url = new URL(location.href)
    const data = sample_queries.map((query) => {
      url.searchParams.set('target', name)
      url.searchParams.set('query', query)

      if(readTimeout) {
        url.searchParams.set('read_timeout', readTimeout)
      }

      return {
        query,
        href: url.toString()
      }
    })

    dom.innerHTML = template(data)
  } else {
    dom.innerHTML = ''
  }
}

},{"handlebars":32}],56:[function(require,module,exports){
module.exports = function(target) {
  const myHeaders = new Headers()
  myHeaders.set('Accept', 'application/json')

  return fetch(`http://targets.lodqa.org/targets/${target}`, {
    method: 'GET',
    headers: myHeaders
  })
    .then((response) => {
      return response.json()
    })
}

},{}],57:[function(require,module,exports){
const initDashboard = require('./controller/grapheditor/dashboard')

document.addEventListener('DOMContentLoaded', () => {
  initDashboard()

  const dashboard = document.querySelector('#dashboard')
  const results = document.querySelector('#results')

  dashboard.addEventListener('click', () => {
    dashboard.classList.remove('dashboard--back')
    results.classList.add('results--back')

    document.querySelector('.examples')
      .classList.add('examples--hidden')
  })

  results.addEventListener('click', () => {
    dashboard.classList.add('dashboard--back')
    results.classList.remove('results--back')
  })
})

},{"./controller/grapheditor/dashboard":52}]},{},[57])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYW1kZWZpbmUvYW1kZWZpbmUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy5ydW50aW1lLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvYmFzZS5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2FzdC5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2UuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9jb21waWxlci9jb2RlLWdlbi5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvaGVscGVycy5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2phdmFzY3JpcHQtY29tcGlsZXIuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9jb21waWxlci9wYXJzZXIuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9jb21waWxlci9wcmludGVyLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvdmlzaXRvci5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL3doaXRlc3BhY2UtY29udHJvbC5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2RlY29yYXRvcnMuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9kZWNvcmF0b3JzL2lubGluZS5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2V4Y2VwdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2hlbHBlcnMuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9oZWxwZXJzL2Jsb2NrLWhlbHBlci1taXNzaW5nLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvaGVscGVycy9lYWNoLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvaGVscGVycy9oZWxwZXItbWlzc2luZy5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2hlbHBlcnMvaWYuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9oZWxwZXJzL2xvZy5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2hlbHBlcnMvbG9va3VwLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvaGVscGVycy93aXRoLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvbG9nZ2VyLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9uby1jb25mbGljdC5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL3J1bnRpbWUuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9zYWZlLXN0cmluZy5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL3V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9hcnJheS1zZXQuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9iYXNlNjQtdmxxLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvYmFzZTY0LmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvYmluYXJ5LXNlYXJjaC5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL21hcHBpbmctbGlzdC5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL3F1aWNrLXNvcnQuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9zb3VyY2UtbWFwLWNvbnN1bWVyLmpzIiwibm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvc291cmNlLW1hcC1nZW5lcmF0b3IuanMiLCJub2RlX21vZHVsZXMvaGFuZGxlYmFycy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9zb3VyY2Utbm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9oYW5kbGViYXJzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL3V0aWwuanMiLCJub2RlX21vZHVsZXMvcGF0aC1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsInNyYy9qcy9jb250cm9sbGVyL2JpbmQtbW9kZS1zd2l0Y2gtZXZlbnRoYW5kbGVyLmpzIiwic3JjL2pzL2NvbnRyb2xsZXIvZ3JhcGhlZGl0b3IvZGFzaGJvYXJkL2JpbmQtcGFyc2UtaXQtYnV0dG9uLWV2ZW50aGFuZGxlci5qcyIsInNyYy9qcy9jb250cm9sbGVyL2dyYXBoZWRpdG9yL2Rhc2hib2FyZC9iaW5kLXRhcmdldC1jaGFuZ2UtZXZlbnRoYW5kbGVyL2FwcGx5LWNvbmZpZy5qcyIsInNyYy9qcy9jb250cm9sbGVyL2dyYXBoZWRpdG9yL2Rhc2hib2FyZC9iaW5kLXRhcmdldC1jaGFuZ2UtZXZlbnRoYW5kbGVyL2NoYW5nZS10YXJnZXQuanMiLCJzcmMvanMvY29udHJvbGxlci9ncmFwaGVkaXRvci9kYXNoYm9hcmQvYmluZC10YXJnZXQtY2hhbmdlLWV2ZW50aGFuZGxlci9pbmRleC5qcyIsInNyYy9qcy9jb250cm9sbGVyL2dyYXBoZWRpdG9yL2Rhc2hib2FyZC9iaW5kLXRhcmdldC1jaGFuZ2UtZXZlbnRoYW5kbGVyL3NldC1kaWN0aW9uYXJ5LXVybC5qcyIsInNyYy9qcy9jb250cm9sbGVyL2dyYXBoZWRpdG9yL2Rhc2hib2FyZC9pbmRleC5qcyIsInNyYy9qcy9jb250cm9sbGVyL2dyYXBoZWRpdG9yL2Rhc2hib2FyZC9pbml0LWdycGFoLWVkaXRvci5qcyIsInNyYy9qcy9jb250cm9sbGVyL2dyYXBoZWRpdG9yL2Rhc2hib2FyZC9pbml0LXNhbXBsZS1xdWVyaWVzLmpzIiwic3JjL2pzL2NvbnRyb2xsZXIvZ3JhcGhlZGl0b3IvZGFzaGJvYXJkL3VwZGF0ZS1zYW1wbGUtcXVlcmllcy5qcyIsInNyYy9qcy9nZXQtdGFyZ2V0LWNvbmZpZy5qcyIsInNyYy9qcy9ncmFwaGVkaXRvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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LENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFD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LENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDdEUsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZGLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN0RiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ3JKLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDckksMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNySSwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0FBQy9FLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQ0gsd0JBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUM7d0JBQzdFLE9BQU8sR0FBRyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN6RCwyQkFBTyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7O0FBRXZCLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDOztBQUV0RSwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4QiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBQyxDQUFDO0FBQzFFLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdEgsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN0SCwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUNILHdCQUFJLENBQUMsQ0FBQyxHQUFHO0FBQ1AsNEJBQUksRUFBRSxrQkFBa0I7QUFDeEIsNEJBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQztBQUNkLDhCQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUM7QUFDaEIsNEJBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQztBQUNkLDhCQUFNLEVBQUUsRUFBRTtBQUNWLDZCQUFLLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN0QywyQkFBRyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztxQkFDekIsQ0FBQzs7QUFFTiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM3RSwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQzlHLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3hCLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3hCLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQ0gsd0JBQUksQ0FBQyxDQUFDLEdBQUc7QUFDUCw0QkFBSSxFQUFFLGVBQWU7QUFDckIsNEJBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQztBQUNkLDhCQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUM7QUFDaEIsNEJBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQztBQUNkLDJCQUFHLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO3FCQUN6QixDQUFDOztBQUVOLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7QUFDekUsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7QUFDbkcsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQywwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4QiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4QiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7QUFDcEcsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBQyxDQUFDO0FBQ3BILDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxNQUFNLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7QUFDM0gsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7QUFDN0csMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBQyxDQUFDO0FBQzlGLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3hCLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3hCLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN2RCwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDeEQsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBRSxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxBQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RywwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUMsQ0FBQztBQUMzRCwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUNwQiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHNCQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM5QiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDMUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyxzQkFBRSxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDOUIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzFCLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsc0JBQUUsQ0FBQyxFQUFFLEdBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzlCLDBCQUFNO0FBQUEsQUFDTixxQkFBSyxHQUFHO0FBQUMsd0JBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMzQiwwQkFBTTtBQUFBLEFBQ04scUJBQUssR0FBRztBQUFDLHNCQUFFLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMvQiwwQkFBTTtBQUFBLGFBQ0w7U0FDQTtBQUNELGFBQUssRUFBRSxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsR0FBRyxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsR0FBRyxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsR0FBRyxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsR0FBRyxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsR0FBRyxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsR0FBRyxDQUFDLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsR0FBRyxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLENBQUMsRUFBQyxFQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsQ0FBQztBQUN4Z1csc0JBQWMsRUFBRSxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxFQUFDO0FBQzdNLGtCQUFVLEVBQUUsU0FBUyxVQUFVLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtBQUN2QyxrQkFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUN4QjtBQUNELGFBQUssRUFBRSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUU7QUFDekIsZ0JBQUksSUFBSSxHQUFHLElBQUk7Z0JBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQztnQkFBRSxNQUFNLEdBQUcsRUFBRTtn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Q2xCLDJCQUFPLEVBQUUsQ0FBQzs7QUFFNUMsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLEFBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkMsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQyx3QkFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLEFBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkMsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFDTCx3QkFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdkIsd0JBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUNoQix3QkFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQzs7QUFFcEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFDTCx3QkFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ2hCLDJCQUFPLEVBQUUsQ0FBQzs7QUFFWiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLDJCQUFPLEVBQUUsQ0FBQztBQUNsQiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLDJCQUFPLEVBQUUsQ0FBQztBQUNsQiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLDJCQUFPLEVBQUUsQ0FBQztBQUNsQiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLDJCQUFPLEVBQUUsQ0FBQztBQUNsQiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLDJCQUFPLEVBQUUsQ0FBQztBQUNsQiwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTs7QUFDUCwwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQUFBQyxPQUFPLEVBQUUsQ0FBQztBQUNuQywwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHdCQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQUFBQyxPQUFPLEVBQUUsQ0FBQztBQUNuQywwQkFBTTtBQUFBLEFBQ04scUJBQUssRUFBRTtBQUFDLHVCQUFHLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBQyxHQUFHLENBQUMsQ0FBQyxBQUFDLE9BQU8sRUFBRSxDQUFDO0FBQy9ELDBCQUFNO0FBQUEsQUFDTixxQkFBSyxFQUFFO0FBQUMsdUJBQUcsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFDLEdBQUcsQ0FBQyxDQUFDLEFBQUMsT0FBTyxFQUFFLENBQUM7QUFDL0QsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFDbEIsMEJBQU07QUFBQSxBQUNOLHFCQUFLLEVBQUU7QUFBQywyQkFBTyxFQUFFLENBQUM7QUFD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QUFDdkIsU0FBTyxLQUFLLENBQUM7Q0FDZDs7QUFFTSxTQUFTLFdBQVcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFO0FBQ3ZDLFFBQU0sQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ2xCLFNBQU8sTUFBTSxDQUFDO0NBQ2Y7O0FBRU0sU0FBUyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsRUFBRSxFQUFFO0FBQ2pELFNBQU8sQ0FBQyxXQUFXLEdBQUcsV0FBVyxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUEsR0FBSSxFQUFFLENBQUM7Q0FDcEQ7Ozs7QUMzR0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcmpDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvWUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqIHZpbTogZXQ6dHM9NDpzdz00OnN0cz00XG4gKiBAbGljZW5zZSBhbWRlZmluZSAxLjAuMSBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxNiwgVGhlIERvam8gRm91bmRhdGlvbiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogQXZhaWxhYmxlIHZpYSB0aGUgTUlUIG9yIG5ldyBCU0QgbGljZW5zZS5cbiAqIHNlZTogaHR0cDovL2dpdGh1Yi5jb20vanJidXJrZS9hbWRlZmluZSBmb3IgZGV0YWlsc1xuICovXG5cbi8qanNsaW50IG5vZGU6IHRydWUgKi9cbi8qZ2xvYmFsIG1vZHVsZSwgcHJvY2VzcyAqL1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBkZWZpbmUgZm9yIG5vZGUuXG4gKiBAcGFyYW0ge09iamVjdH0gbW9kdWxlIHRoZSBcIm1vZHVsZVwiIG9iamVjdCB0aGF0IGlzIGRlZmluZWQgYnkgTm9kZSBmb3IgdGhlXG4gKiBjdXJyZW50IG1vZHVsZS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtyZXF1aXJlRm5dLiBOb2RlJ3MgcmVxdWlyZSBmdW5jdGlvbiBmb3IgdGhlIGN1cnJlbnQgbW9kdWxlLlxuICogSXQgb25seSBuZWVkcyB0byBiZSBwYXNzZWQgaW4gTm9kZSB2ZXJzaW9ucyBiZWZvcmUgMC41LCB3aGVuIG1vZHVsZS5yZXF1aXJlXG4gKiBkaWQgbm90IGV4aXN0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBhIGRlZmluZSBmdW5jdGlvbiB0aGF0IGlzIHVzYWJsZSBmb3IgdGhlIGN1cnJlbnQgbm9kZVxuICogbW9kdWxlLlxuICovXG5mdW5jdGlvbiBhbWRlZmluZShtb2R1bGUsIHJlcXVpcmVGbikge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICB2YXIgZGVmaW5lQ2FjaGUgPSB7fSxcbiAgICAgICAgbG9hZGVyQ2FjaGUgPSB7fSxcbiAgICAgICAgYWxyZWFkeUNhbGxlZCA9IGZhbHNlLFxuICAgICAgICBwYXRoID0gcmVxdWlyZSgncGF0aCcpLFxuICAgICAgICBtYWtlUmVxdWlyZSwgc3RyaW5nUmVxdWlyZTtcblxuICAgIC8qKlxuICAgICAqIFRyaW1zIHRoZSAuIGFuZCAuLiBmcm9tIGFuIGFycmF5IG9mIHBhdGggc2VnbWVudHMuXG4gICAgICogSXQgd2lsbCBrZWVwIGEgbGVhZGluZyBwYXRoIHNlZ21lbnQgaWYgYSAuLiB3aWxsIGJlY29tZVxuICAgICAqIHRoZSBmaXJzdCBwYXRoIHNlZ21lbnQsIHRvIGhlbHAgd2l0aCBtb2R1bGUgbmFtZSBsb29rdXBzLFxuICAgICAqIHdoaWNoIGFjdCBsaWtlIHBhdGhzLCBidXQgY2FuIGJlIHJlbWFwcGVkLiBCdXQgdGhlIGVuZCByZXN1bHQsXG4gICAgICogYWxsIHBhdGhzIHRoYXQgdXNlIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGxvb2sgbm9ybWFsaXplZC5cbiAgICAgKiBOT1RFOiB0aGlzIG1ldGhvZCBNT0RJRklFUyB0aGUgaW5wdXQgYXJyYXkuXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJ5IHRoZSBhcnJheSBvZiBwYXRoIHNlZ21lbnRzLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRyaW1Eb3RzKGFyeSkge1xuICAgICAgICB2YXIgaSwgcGFydDtcbiAgICAgICAgZm9yIChpID0gMDsgYXJ5W2ldOyBpKz0gMSkge1xuICAgICAgICAgICAgcGFydCA9IGFyeVtpXTtcbiAgICAgICAgICAgIGlmIChwYXJ0ID09PSAnLicpIHtcbiAgICAgICAgICAgICAgICBhcnkuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGkgLT0gMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGFydCA9PT0gJy4uJykge1xuICAgICAgICAgICAgICAgIGlmIChpID09PSAxICYmIChhcnlbMl0gPT09ICcuLicgfHwgYXJ5WzBdID09PSAnLi4nKSkge1xuICAgICAgICAgICAgICAgICAgICAvL0VuZCBvZiB0aGUgbGluZS4gS2VlcCBhdCBsZWFzdCBvbmUgbm9uLWRvdFxuICAgICAgICAgICAgICAgICAgICAvL3BhdGggc2VnbWVudCBhdCB0aGUgZnJvbnQgc28gaXQgY2FuIGJlIG1hcHBlZFxuICAgICAgICAgICAgICAgICAgICAvL2NvcnJlY3RseSB0byBkaXNrLiBPdGhlcndpc2UsIHRoZXJlIGlzIGxpa2VseVxuICAgICAgICAgICAgICAgICAgICAvL25vIHBhdGggbWFwcGluZyBmb3IgYSBwYXRoIHN0YXJ0aW5nIHdpdGggJy4uJy5cbiAgICAgICAgICAgICAgICAgICAgLy9UaGlzIGNhbiBzdGlsbCBmYWlsLCBidXQgY2F0Y2hlcyB0aGUgbW9zdCByZWFzb25hYmxlXG4gICAgICAgICAgICAgICAgICAgIC8vdXNlcyBvZiAuLlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyeS5zcGxpY2UoaSAtIDEsIDIpO1xuICAgICAgICAgICAgICAgICAgICBpIC09IDI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbm9ybWFsaXplKG5hbWUsIGJhc2VOYW1lKSB7XG4gICAgICAgIHZhciBiYXNlUGFydHM7XG5cbiAgICAgICAgLy9BZGp1c3QgYW55IHJlbGF0aXZlIHBhdGhzLlxuICAgICAgICBpZiAobmFtZSAmJiBuYW1lLmNoYXJBdCgwKSA9PT0gJy4nKSB7XG4gICAgICAgICAgICAvL0lmIGhhdmUgYSBiYXNlIG5hbWUsIHRyeSB0byBub3JtYWxpemUgYWdhaW5zdCBpdCxcbiAgICAgICAgICAgIC8vb3RoZXJ3aXNlLCBhc3N1bWUgaXQgaXMgYSB0b3AtbGV2ZWwgcmVxdWlyZSB0aGF0IHdpbGxcbiAgICAgICAgICAgIC8vYmUgcmVsYXRpdmUgdG8gYmFzZVVybCBpbiB0aGUgZW5kLlxuICAgICAgICAgICAgaWYgKGJhc2VOYW1lKSB7XG4gICAgICAgICAgICAgICAgYmFzZVBhcnRzID0gYmFzZU5hbWUuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICBiYXNlUGFydHMgPSBiYXNlUGFydHMuc2xpY2UoMCwgYmFzZVBhcnRzLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIGJhc2VQYXJ0cyA9IGJhc2VQYXJ0cy5jb25jYXQobmFtZS5zcGxpdCgnLycpKTtcbiAgICAgICAgICAgICAgICB0cmltRG90cyhiYXNlUGFydHMpO1xuICAgICAgICAgICAgICAgIG5hbWUgPSBiYXNlUGFydHMuam9pbignLycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIHRoZSBub3JtYWxpemUoKSBmdW5jdGlvbiBwYXNzZWQgdG8gYSBsb2FkZXIgcGx1Z2luJ3NcbiAgICAgKiBub3JtYWxpemUgbWV0aG9kLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG1ha2VOb3JtYWxpemUocmVsTmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBub3JtYWxpemUobmFtZSwgcmVsTmFtZSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUxvYWQoaWQpIHtcbiAgICAgICAgZnVuY3Rpb24gbG9hZCh2YWx1ZSkge1xuICAgICAgICAgICAgbG9hZGVyQ2FjaGVbaWRdID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBsb2FkLmZyb21UZXh0ID0gZnVuY3Rpb24gKGlkLCB0ZXh0KSB7XG4gICAgICAgICAgICAvL1RoaXMgb25lIGlzIGRpZmZpY3VsdCBiZWNhdXNlIHRoZSB0ZXh0IGNhbi9wcm9iYWJseSB1c2VzXG4gICAgICAgICAgICAvL2RlZmluZSwgYW5kIGFueSByZWxhdGl2ZSBwYXRocyBhbmQgcmVxdWlyZXMgc2hvdWxkIGJlIHJlbGF0aXZlXG4gICAgICAgICAgICAvL3RvIHRoYXQgaWQgd2FzIGl0IHdvdWxkIGJlIGZvdW5kIG9uIGRpc2suIEJ1dCB0aGlzIHdvdWxkIHJlcXVpcmVcbiAgICAgICAgICAgIC8vYm9vdHN0cmFwcGluZyBhIG1vZHVsZS9yZXF1aXJlIGZhaXJseSBkZWVwbHkgZnJvbSBub2RlIGNvcmUuXG4gICAgICAgICAgICAvL05vdCBzdXJlIGhvdyBiZXN0IHRvIGdvIGFib3V0IHRoYXQgeWV0LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhbWRlZmluZSBkb2VzIG5vdCBpbXBsZW1lbnQgbG9hZC5mcm9tVGV4dCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBsb2FkO1xuICAgIH1cblxuICAgIG1ha2VSZXF1aXJlID0gZnVuY3Rpb24gKHN5c3RlbVJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSwgcmVsSWQpIHtcbiAgICAgICAgZnVuY3Rpb24gYW1kUmVxdWlyZShkZXBzLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBkZXBzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIC8vU3luY2hyb25vdXMsIHNpbmdsZSBtb2R1bGUgcmVxdWlyZSgnJylcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RyaW5nUmVxdWlyZShzeXN0ZW1SZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUsIGRlcHMsIHJlbElkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy9BcnJheSBvZiBkZXBlbmRlbmNpZXMgd2l0aCBhIGNhbGxiYWNrLlxuXG4gICAgICAgICAgICAgICAgLy9Db252ZXJ0IHRoZSBkZXBlbmRlbmNpZXMgdG8gbW9kdWxlcy5cbiAgICAgICAgICAgICAgICBkZXBzID0gZGVwcy5tYXAoZnVuY3Rpb24gKGRlcE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0cmluZ1JlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCBkZXBOYW1lLCByZWxJZCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvL1dhaXQgZm9yIG5leHQgdGljayB0byBjYWxsIGJhY2sgdGhlIHJlcXVpcmUgY2FsbC5cbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShudWxsLCBkZXBzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYW1kUmVxdWlyZS50b1VybCA9IGZ1bmN0aW9uIChmaWxlUGF0aCkge1xuICAgICAgICAgICAgaWYgKGZpbGVQYXRoLmluZGV4T2YoJy4nKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBub3JtYWxpemUoZmlsZVBhdGgsIHBhdGguZGlybmFtZShtb2R1bGUuZmlsZW5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBhbWRSZXF1aXJlO1xuICAgIH07XG5cbiAgICAvL0Zhdm9yIGV4cGxpY2l0IHZhbHVlLCBwYXNzZWQgaW4gaWYgdGhlIG1vZHVsZSB3YW50cyB0byBzdXBwb3J0IE5vZGUgMC40LlxuICAgIHJlcXVpcmVGbiA9IHJlcXVpcmVGbiB8fCBmdW5jdGlvbiByZXEoKSB7XG4gICAgICAgIHJldHVybiBtb2R1bGUucmVxdWlyZS5hcHBseShtb2R1bGUsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHJ1bkZhY3RvcnkoaWQsIGRlcHMsIGZhY3RvcnkpIHtcbiAgICAgICAgdmFyIHIsIGUsIG0sIHJlc3VsdDtcblxuICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgIGUgPSBsb2FkZXJDYWNoZVtpZF0gPSB7fTtcbiAgICAgICAgICAgIG0gPSB7XG4gICAgICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgICAgIHVyaTogX19maWxlbmFtZSxcbiAgICAgICAgICAgICAgICBleHBvcnRzOiBlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgciA9IG1ha2VSZXF1aXJlKHJlcXVpcmVGbiwgZSwgbSwgaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9Pbmx5IHN1cHBvcnQgb25lIGRlZmluZSBjYWxsIHBlciBmaWxlXG4gICAgICAgICAgICBpZiAoYWxyZWFkeUNhbGxlZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYW1kZWZpbmUgd2l0aCBubyBtb2R1bGUgSUQgY2Fubm90IGJlIGNhbGxlZCBtb3JlIHRoYW4gb25jZSBwZXIgZmlsZS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFscmVhZHlDYWxsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvL1VzZSB0aGUgcmVhbCB2YXJpYWJsZXMgZnJvbSBub2RlXG4gICAgICAgICAgICAvL1VzZSBtb2R1bGUuZXhwb3J0cyBmb3IgZXhwb3J0cywgc2luY2VcbiAgICAgICAgICAgIC8vdGhlIGV4cG9ydHMgaW4gaGVyZSBpcyBhbWRlZmluZSBleHBvcnRzLlxuICAgICAgICAgICAgZSA9IG1vZHVsZS5leHBvcnRzO1xuICAgICAgICAgICAgbSA9IG1vZHVsZTtcbiAgICAgICAgICAgIHIgPSBtYWtlUmVxdWlyZShyZXF1aXJlRm4sIGUsIG0sIG1vZHVsZS5pZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvL0lmIHRoZXJlIGFyZSBkZXBlbmRlbmNpZXMsIHRoZXkgYXJlIHN0cmluZ3MsIHNvIG5lZWRcbiAgICAgICAgLy90byBjb252ZXJ0IHRoZW0gdG8gZGVwZW5kZW5jeSB2YWx1ZXMuXG4gICAgICAgIGlmIChkZXBzKSB7XG4gICAgICAgICAgICBkZXBzID0gZGVwcy5tYXAoZnVuY3Rpb24gKGRlcE5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcihkZXBOYW1lKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9DYWxsIHRoZSBmYWN0b3J5IHdpdGggdGhlIHJpZ2h0IGRlcGVuZGVuY2llcy5cbiAgICAgICAgaWYgKHR5cGVvZiBmYWN0b3J5ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBmYWN0b3J5LmFwcGx5KG0uZXhwb3J0cywgZGVwcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBmYWN0b3J5O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBtLmV4cG9ydHMgPSByZXN1bHQ7XG4gICAgICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXJDYWNoZVtpZF0gPSBtLmV4cG9ydHM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdHJpbmdSZXF1aXJlID0gZnVuY3Rpb24gKHN5c3RlbVJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSwgaWQsIHJlbElkKSB7XG4gICAgICAgIC8vU3BsaXQgdGhlIElEIGJ5IGEgISBzbyB0aGF0XG4gICAgICAgIHZhciBpbmRleCA9IGlkLmluZGV4T2YoJyEnKSxcbiAgICAgICAgICAgIG9yaWdpbmFsSWQgPSBpZCxcbiAgICAgICAgICAgIHByZWZpeCwgcGx1Z2luO1xuXG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIGlkID0gbm9ybWFsaXplKGlkLCByZWxJZCk7XG5cbiAgICAgICAgICAgIC8vU3RyYWlnaHQgbW9kdWxlIGxvb2t1cC4gSWYgaXQgaXMgb25lIG9mIHRoZSBzcGVjaWFsIGRlcGVuZGVuY2llcyxcbiAgICAgICAgICAgIC8vZGVhbCB3aXRoIGl0LCBvdGhlcndpc2UsIGRlbGVnYXRlIHRvIG5vZGUuXG4gICAgICAgICAgICBpZiAoaWQgPT09ICdyZXF1aXJlJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBtYWtlUmVxdWlyZShzeXN0ZW1SZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUsIHJlbElkKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaWQgPT09ICdleHBvcnRzJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBleHBvcnRzO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpZCA9PT0gJ21vZHVsZScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kdWxlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChsb2FkZXJDYWNoZS5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZGVyQ2FjaGVbaWRdO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWZpbmVDYWNoZVtpZF0pIHtcbiAgICAgICAgICAgICAgICBydW5GYWN0b3J5LmFwcGx5KG51bGwsIGRlZmluZUNhY2hlW2lkXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYoc3lzdGVtUmVxdWlyZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3lzdGVtUmVxdWlyZShvcmlnaW5hbElkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1vZHVsZSB3aXRoIElEOiAnICsgaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vVGhlcmUgaXMgYSBwbHVnaW4gaW4gcGxheS5cbiAgICAgICAgICAgIHByZWZpeCA9IGlkLnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICAgICAgICBpZCA9IGlkLnN1YnN0cmluZyhpbmRleCArIDEsIGlkLmxlbmd0aCk7XG5cbiAgICAgICAgICAgIHBsdWdpbiA9IHN0cmluZ1JlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCBwcmVmaXgsIHJlbElkKTtcblxuICAgICAgICAgICAgaWYgKHBsdWdpbi5ub3JtYWxpemUpIHtcbiAgICAgICAgICAgICAgICBpZCA9IHBsdWdpbi5ub3JtYWxpemUoaWQsIG1ha2VOb3JtYWxpemUocmVsSWQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy9Ob3JtYWxpemUgdGhlIElEIG5vcm1hbGx5LlxuICAgICAgICAgICAgICAgIGlkID0gbm9ybWFsaXplKGlkLCByZWxJZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsb2FkZXJDYWNoZVtpZF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZGVyQ2FjaGVbaWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwbHVnaW4ubG9hZChpZCwgbWFrZVJlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCByZWxJZCksIG1ha2VMb2FkKGlkKSwge30pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvL0NyZWF0ZSBhIGRlZmluZSBmdW5jdGlvbiBzcGVjaWZpYyB0byB0aGUgbW9kdWxlIGFza2luZyBmb3IgYW1kZWZpbmUuXG4gICAgZnVuY3Rpb24gZGVmaW5lKGlkLCBkZXBzLCBmYWN0b3J5KSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGlkKSkge1xuICAgICAgICAgICAgZmFjdG9yeSA9IGRlcHM7XG4gICAgICAgICAgICBkZXBzID0gaWQ7XG4gICAgICAgICAgICBpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBmYWN0b3J5ID0gaWQ7XG4gICAgICAgICAgICBpZCA9IGRlcHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVwcyAmJiAhQXJyYXkuaXNBcnJheShkZXBzKSkge1xuICAgICAgICAgICAgZmFjdG9yeSA9IGRlcHM7XG4gICAgICAgICAgICBkZXBzID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkZXBzKSB7XG4gICAgICAgICAgICBkZXBzID0gWydyZXF1aXJlJywgJ2V4cG9ydHMnLCAnbW9kdWxlJ107XG4gICAgICAgIH1cblxuICAgICAgICAvL1NldCB1cCBwcm9wZXJ0aWVzIGZvciB0aGlzIG1vZHVsZS4gSWYgYW4gSUQsIHRoZW4gdXNlXG4gICAgICAgIC8vaW50ZXJuYWwgY2FjaGUuIElmIG5vIElELCB0aGVuIHVzZSB0aGUgZXh0ZXJuYWwgdmFyaWFibGVzXG4gICAgICAgIC8vZm9yIHRoaXMgbm9kZSBtb2R1bGUuXG4gICAgICAgIGlmIChpZCkge1xuICAgICAgICAgICAgLy9QdXQgdGhlIG1vZHVsZSBpbiBkZWVwIGZyZWV6ZSB1bnRpbCB0aGVyZSBpcyBhXG4gICAgICAgICAgICAvL3JlcXVpcmUgY2FsbCBmb3IgaXQuXG4gICAgICAgICAgICBkZWZpbmVDYWNoZVtpZF0gPSBbaWQsIGRlcHMsIGZhY3RvcnldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcnVuRmFjdG9yeShpZCwgZGVwcywgZmFjdG9yeSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL2RlZmluZS5yZXF1aXJlLCB3aGljaCBoYXMgYWNjZXNzIHRvIGFsbCB0aGUgdmFsdWVzIGluIHRoZVxuICAgIC8vY2FjaGUuIFVzZWZ1bCBmb3IgQU1EIG1vZHVsZXMgdGhhdCBhbGwgaGF2ZSBJRHMgaW4gdGhlIGZpbGUsXG4gICAgLy9idXQgbmVlZCB0byBmaW5hbGx5IGV4cG9ydCBhIHZhbHVlIHRvIG5vZGUgYmFzZWQgb24gb25lIG9mIHRob3NlXG4gICAgLy9JRHMuXG4gICAgZGVmaW5lLnJlcXVpcmUgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgaWYgKGxvYWRlckNhY2hlW2lkXSkge1xuICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZWZpbmVDYWNoZVtpZF0pIHtcbiAgICAgICAgICAgIHJ1bkZhY3RvcnkuYXBwbHkobnVsbCwgZGVmaW5lQ2FjaGVbaWRdKTtcbiAgICAgICAgICAgIHJldHVybiBsb2FkZXJDYWNoZVtpZF07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVmaW5lLmFtZCA9IHt9O1xuXG4gICAgcmV0dXJuIGRlZmluZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhbWRlZmluZTtcbiIsIiIsImltcG9ydCBydW50aW1lIGZyb20gJy4vaGFuZGxlYmFycy5ydW50aW1lJztcblxuLy8gQ29tcGlsZXIgaW1wb3J0c1xuaW1wb3J0IEFTVCBmcm9tICcuL2hhbmRsZWJhcnMvY29tcGlsZXIvYXN0JztcbmltcG9ydCB7IHBhcnNlciBhcyBQYXJzZXIsIHBhcnNlIH0gZnJvbSAnLi9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2UnO1xuaW1wb3J0IHsgQ29tcGlsZXIsIGNvbXBpbGUsIHByZWNvbXBpbGUgfSBmcm9tICcuL2hhbmRsZWJhcnMvY29tcGlsZXIvY29tcGlsZXInO1xuaW1wb3J0IEphdmFTY3JpcHRDb21waWxlciBmcm9tICcuL2hhbmRsZWJhcnMvY29tcGlsZXIvamF2YXNjcmlwdC1jb21waWxlcic7XG5pbXBvcnQgVmlzaXRvciBmcm9tICcuL2hhbmRsZWJhcnMvY29tcGlsZXIvdmlzaXRvcic7XG5cbmltcG9ydCBub0NvbmZsaWN0IGZyb20gJy4vaGFuZGxlYmFycy9uby1jb25mbGljdCc7XG5cbmxldCBfY3JlYXRlID0gcnVudGltZS5jcmVhdGU7XG5mdW5jdGlvbiBjcmVhdGUoKSB7XG4gIGxldCBoYiA9IF9jcmVhdGUoKTtcblxuICBoYi5jb21waWxlID0gZnVuY3Rpb24oaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gY29tcGlsZShpbnB1dCwgb3B0aW9ucywgaGIpO1xuICB9O1xuICBoYi5wcmVjb21waWxlID0gZnVuY3Rpb24oaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gcHJlY29tcGlsZShpbnB1dCwgb3B0aW9ucywgaGIpO1xuICB9O1xuXG4gIGhiLkFTVCA9IEFTVDtcbiAgaGIuQ29tcGlsZXIgPSBDb21waWxlcjtcbiAgaGIuSmF2YVNjcmlwdENvbXBpbGVyID0gSmF2YVNjcmlwdENvbXBpbGVyO1xuICBoYi5QYXJzZXIgPSBQYXJzZXI7XG4gIGhiLnBhcnNlID0gcGFyc2U7XG5cbiAgcmV0dXJuIGhiO1xufVxuXG5sZXQgaW5zdCA9IGNyZWF0ZSgpO1xuaW5zdC5jcmVhdGUgPSBjcmVhdGU7XG5cbm5vQ29uZmxpY3QoaW5zdCk7XG5cbmluc3QuVmlzaXRvciA9IFZpc2l0b3I7XG5cbmluc3RbJ2RlZmF1bHQnXSA9IGluc3Q7XG5cbmV4cG9ydCBkZWZhdWx0IGluc3Q7XG4iLCJpbXBvcnQgKiBhcyBiYXNlIGZyb20gJy4vaGFuZGxlYmFycy9iYXNlJztcblxuLy8gRWFjaCBvZiB0aGVzZSBhdWdtZW50IHRoZSBIYW5kbGViYXJzIG9iamVjdC4gTm8gbmVlZCB0byBzZXR1cCBoZXJlLlxuLy8gKFRoaXMgaXMgZG9uZSB0byBlYXNpbHkgc2hhcmUgY29kZSBiZXR3ZWVuIGNvbW1vbmpzIGFuZCBicm93c2UgZW52cylcbmltcG9ydCBTYWZlU3RyaW5nIGZyb20gJy4vaGFuZGxlYmFycy9zYWZlLXN0cmluZyc7XG5pbXBvcnQgRXhjZXB0aW9uIGZyb20gJy4vaGFuZGxlYmFycy9leGNlcHRpb24nO1xuaW1wb3J0ICogYXMgVXRpbHMgZnJvbSAnLi9oYW5kbGViYXJzL3V0aWxzJztcbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSAnLi9oYW5kbGViYXJzL3J1bnRpbWUnO1xuXG5pbXBvcnQgbm9Db25mbGljdCBmcm9tICcuL2hhbmRsZWJhcnMvbm8tY29uZmxpY3QnO1xuXG4vLyBGb3IgY29tcGF0aWJpbGl0eSBhbmQgdXNhZ2Ugb3V0c2lkZSBvZiBtb2R1bGUgc3lzdGVtcywgbWFrZSB0aGUgSGFuZGxlYmFycyBvYmplY3QgYSBuYW1lc3BhY2VcbmZ1bmN0aW9uIGNyZWF0ZSgpIHtcbiAgbGV0IGhiID0gbmV3IGJhc2UuSGFuZGxlYmFyc0Vudmlyb25tZW50KCk7XG5cbiAgVXRpbHMuZXh0ZW5kKGhiLCBiYXNlKTtcbiAgaGIuU2FmZVN0cmluZyA9IFNhZmVTdHJpbmc7XG4gIGhiLkV4Y2VwdGlvbiA9IEV4Y2VwdGlvbjtcbiAgaGIuVXRpbHMgPSBVdGlscztcbiAgaGIuZXNjYXBlRXhwcmVzc2lvbiA9IFV0aWxzLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgaGIuVk0gPSBydW50aW1lO1xuICBoYi50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHNwZWMpIHtcbiAgICByZXR1cm4gcnVudGltZS50ZW1wbGF0ZShzcGVjLCBoYik7XG4gIH07XG5cbiAgcmV0dXJuIGhiO1xufVxuXG5sZXQgaW5zdCA9IGNyZWF0ZSgpO1xuaW5zdC5jcmVhdGUgPSBjcmVhdGU7XG5cbm5vQ29uZmxpY3QoaW5zdCk7XG5cbmluc3RbJ2RlZmF1bHQnXSA9IGluc3Q7XG5cbmV4cG9ydCBkZWZhdWx0IGluc3Q7XG4iLCJpbXBvcnQge2NyZWF0ZUZyYW1lLCBleHRlbmQsIHRvU3RyaW5nfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCBFeGNlcHRpb24gZnJvbSAnLi9leGNlcHRpb24nO1xuaW1wb3J0IHtyZWdpc3RlckRlZmF1bHRIZWxwZXJzfSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHtyZWdpc3RlckRlZmF1bHREZWNvcmF0b3JzfSBmcm9tICcuL2RlY29yYXRvcnMnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuL2xvZ2dlcic7XG5cbmV4cG9ydCBjb25zdCBWRVJTSU9OID0gJzQuMC4xMSc7XG5leHBvcnQgY29uc3QgQ09NUElMRVJfUkVWSVNJT04gPSA3O1xuXG5leHBvcnQgY29uc3QgUkVWSVNJT05fQ0hBTkdFUyA9IHtcbiAgMTogJzw9IDEuMC5yYy4yJywgLy8gMS4wLnJjLjIgaXMgYWN0dWFsbHkgcmV2MiBidXQgZG9lc24ndCByZXBvcnQgaXRcbiAgMjogJz09IDEuMC4wLXJjLjMnLFxuICAzOiAnPT0gMS4wLjAtcmMuNCcsXG4gIDQ6ICc9PSAxLngueCcsXG4gIDU6ICc9PSAyLjAuMC1hbHBoYS54JyxcbiAgNjogJz49IDIuMC4wLWJldGEuMScsXG4gIDc6ICc+PSA0LjAuMCdcbn07XG5cbmNvbnN0IG9iamVjdFR5cGUgPSAnW29iamVjdCBPYmplY3RdJztcblxuZXhwb3J0IGZ1bmN0aW9uIEhhbmRsZWJhcnNFbnZpcm9ubWVudChoZWxwZXJzLCBwYXJ0aWFscywgZGVjb3JhdG9ycykge1xuICB0aGlzLmhlbHBlcnMgPSBoZWxwZXJzIHx8IHt9O1xuICB0aGlzLnBhcnRpYWxzID0gcGFydGlhbHMgfHwge307XG4gIHRoaXMuZGVjb3JhdG9ycyA9IGRlY29yYXRvcnMgfHwge307XG5cbiAgcmVnaXN0ZXJEZWZhdWx0SGVscGVycyh0aGlzKTtcbiAgcmVnaXN0ZXJEZWZhdWx0RGVjb3JhdG9ycyh0aGlzKTtcbn1cblxuSGFuZGxlYmFyc0Vudmlyb25tZW50LnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IEhhbmRsZWJhcnNFbnZpcm9ubWVudCxcblxuICBsb2dnZXI6IGxvZ2dlcixcbiAgbG9nOiBsb2dnZXIubG9nLFxuXG4gIHJlZ2lzdGVySGVscGVyOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgICBpZiAoZm4pIHsgdGhyb3cgbmV3IEV4Y2VwdGlvbignQXJnIG5vdCBzdXBwb3J0ZWQgd2l0aCBtdWx0aXBsZSBoZWxwZXJzJyk7IH1cbiAgICAgIGV4dGVuZCh0aGlzLmhlbHBlcnMsIG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmhlbHBlcnNbbmFtZV0gPSBmbjtcbiAgICB9XG4gIH0sXG4gIHVucmVnaXN0ZXJIZWxwZXI6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBkZWxldGUgdGhpcy5oZWxwZXJzW25hbWVdO1xuICB9LFxuXG4gIHJlZ2lzdGVyUGFydGlhbDogZnVuY3Rpb24obmFtZSwgcGFydGlhbCkge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgICBleHRlbmQodGhpcy5wYXJ0aWFscywgbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgcGFydGlhbCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihgQXR0ZW1wdGluZyB0byByZWdpc3RlciBhIHBhcnRpYWwgY2FsbGVkIFwiJHtuYW1lfVwiIGFzIHVuZGVmaW5lZGApO1xuICAgICAgfVxuICAgICAgdGhpcy5wYXJ0aWFsc1tuYW1lXSA9IHBhcnRpYWw7XG4gICAgfVxuICB9LFxuICB1bnJlZ2lzdGVyUGFydGlhbDogZnVuY3Rpb24obmFtZSkge1xuICAgIGRlbGV0ZSB0aGlzLnBhcnRpYWxzW25hbWVdO1xuICB9LFxuXG4gIHJlZ2lzdGVyRGVjb3JhdG9yOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgICBpZiAoZm4pIHsgdGhyb3cgbmV3IEV4Y2VwdGlvbignQXJnIG5vdCBzdXBwb3J0ZWQgd2l0aCBtdWx0aXBsZSBkZWNvcmF0b3JzJyk7IH1cbiAgICAgIGV4dGVuZCh0aGlzLmRlY29yYXRvcnMsIG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlY29yYXRvcnNbbmFtZV0gPSBmbjtcbiAgICB9XG4gIH0sXG4gIHVucmVnaXN0ZXJEZWNvcmF0b3I6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBkZWxldGUgdGhpcy5kZWNvcmF0b3JzW25hbWVdO1xuICB9XG59O1xuXG5leHBvcnQgbGV0IGxvZyA9IGxvZ2dlci5sb2c7XG5cbmV4cG9ydCB7Y3JlYXRlRnJhbWUsIGxvZ2dlcn07XG4iLCJsZXQgQVNUID0ge1xuICAvLyBQdWJsaWMgQVBJIHVzZWQgdG8gZXZhbHVhdGUgZGVyaXZlZCBhdHRyaWJ1dGVzIHJlZ2FyZGluZyBBU1Qgbm9kZXNcbiAgaGVscGVyczoge1xuICAgIC8vIGEgbXVzdGFjaGUgaXMgZGVmaW5pdGVseSBhIGhlbHBlciBpZjpcbiAgICAvLyAqIGl0IGlzIGFuIGVsaWdpYmxlIGhlbHBlciwgYW5kXG4gICAgLy8gKiBpdCBoYXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciBvciBoYXNoIHNlZ21lbnRcbiAgICBoZWxwZXJFeHByZXNzaW9uOiBmdW5jdGlvbihub2RlKSB7XG4gICAgICByZXR1cm4gKG5vZGUudHlwZSA9PT0gJ1N1YkV4cHJlc3Npb24nKVxuICAgICAgICAgIHx8ICgobm9kZS50eXBlID09PSAnTXVzdGFjaGVTdGF0ZW1lbnQnIHx8IG5vZGUudHlwZSA9PT0gJ0Jsb2NrU3RhdGVtZW50JylcbiAgICAgICAgICAgICYmICEhKChub2RlLnBhcmFtcyAmJiBub2RlLnBhcmFtcy5sZW5ndGgpIHx8IG5vZGUuaGFzaCkpO1xuICAgIH0sXG5cbiAgICBzY29wZWRJZDogZnVuY3Rpb24ocGF0aCkge1xuICAgICAgcmV0dXJuICgvXlxcLnx0aGlzXFxiLykudGVzdChwYXRoLm9yaWdpbmFsKTtcbiAgICB9LFxuXG4gICAgLy8gYW4gSUQgaXMgc2ltcGxlIGlmIGl0IG9ubHkgaGFzIG9uZSBwYXJ0LCBhbmQgdGhhdCBwYXJ0IGlzIG5vdFxuICAgIC8vIGAuLmAgb3IgYHRoaXNgLlxuICAgIHNpbXBsZUlkOiBmdW5jdGlvbihwYXRoKSB7XG4gICAgICByZXR1cm4gcGF0aC5wYXJ0cy5sZW5ndGggPT09IDEgJiYgIUFTVC5oZWxwZXJzLnNjb3BlZElkKHBhdGgpICYmICFwYXRoLmRlcHRoO1xuICAgIH1cbiAgfVxufTtcblxuXG4vLyBNdXN0IGJlIGV4cG9ydGVkIGFzIGFuIG9iamVjdCByYXRoZXIgdGhhbiB0aGUgcm9vdCBvZiB0aGUgbW9kdWxlIGFzIHRoZSBqaXNvbiBsZXhlclxuLy8gbXVzdCBtb2RpZnkgdGhlIG9iamVjdCB0byBvcGVyYXRlIHByb3Blcmx5LlxuZXhwb3J0IGRlZmF1bHQgQVNUO1xuIiwiaW1wb3J0IHBhcnNlciBmcm9tICcuL3BhcnNlcic7XG5pbXBvcnQgV2hpdGVzcGFjZUNvbnRyb2wgZnJvbSAnLi93aGl0ZXNwYWNlLWNvbnRyb2wnO1xuaW1wb3J0ICogYXMgSGVscGVycyBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vdXRpbHMnO1xuXG5leHBvcnQgeyBwYXJzZXIgfTtcblxubGV0IHl5ID0ge307XG5leHRlbmQoeXksIEhlbHBlcnMpO1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2UoaW5wdXQsIG9wdGlvbnMpIHtcbiAgLy8gSnVzdCByZXR1cm4gaWYgYW4gYWxyZWFkeS1jb21waWxlZCBBU1Qgd2FzIHBhc3NlZCBpbi5cbiAgaWYgKGlucHV0LnR5cGUgPT09ICdQcm9ncmFtJykgeyByZXR1cm4gaW5wdXQ7IH1cblxuICBwYXJzZXIueXkgPSB5eTtcblxuICAvLyBBbHRlcmluZyB0aGUgc2hhcmVkIG9iamVjdCBoZXJlLCBidXQgdGhpcyBpcyBvayBhcyBwYXJzZXIgaXMgYSBzeW5jIG9wZXJhdGlvblxuICB5eS5sb2NJbmZvID0gZnVuY3Rpb24obG9jSW5mbykge1xuICAgIHJldHVybiBuZXcgeXkuU291cmNlTG9jYXRpb24ob3B0aW9ucyAmJiBvcHRpb25zLnNyY05hbWUsIGxvY0luZm8pO1xuICB9O1xuXG4gIGxldCBzdHJpcCA9IG5ldyBXaGl0ZXNwYWNlQ29udHJvbChvcHRpb25zKTtcbiAgcmV0dXJuIHN0cmlwLmFjY2VwdChwYXJzZXIucGFyc2UoaW5wdXQpKTtcbn1cbiIsIi8qIGdsb2JhbCBkZWZpbmUgKi9cbmltcG9ydCB7aXNBcnJheX0gZnJvbSAnLi4vdXRpbHMnO1xuXG5sZXQgU291cmNlTm9kZTtcblxudHJ5IHtcbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgaWYgKHR5cGVvZiBkZWZpbmUgIT09ICdmdW5jdGlvbicgfHwgIWRlZmluZS5hbWQpIHtcbiAgICAvLyBXZSBkb24ndCBzdXBwb3J0IHRoaXMgaW4gQU1EIGVudmlyb25tZW50cy4gRm9yIHRoZXNlIGVudmlyb25tZW50cywgd2UgYXN1c21lIHRoYXRcbiAgICAvLyB0aGV5IGFyZSBydW5uaW5nIG9uIHRoZSBicm93c2VyIGFuZCB0aHVzIGhhdmUgbm8gbmVlZCBmb3IgdGhlIHNvdXJjZS1tYXAgbGlicmFyeS5cbiAgICBsZXQgU291cmNlTWFwID0gcmVxdWlyZSgnc291cmNlLW1hcCcpO1xuICAgIFNvdXJjZU5vZGUgPSBTb3VyY2VNYXAuU291cmNlTm9kZTtcbiAgfVxufSBjYXRjaCAoZXJyKSB7XG4gIC8qIE5PUCAqL1xufVxuXG4vKiBpc3RhbmJ1bCBpZ25vcmUgaWY6IHRlc3RlZCBidXQgbm90IGNvdmVyZWQgaW4gaXN0YW5idWwgZHVlIHRvIGRpc3QgYnVpbGQgICovXG5pZiAoIVNvdXJjZU5vZGUpIHtcbiAgU291cmNlTm9kZSA9IGZ1bmN0aW9uKGxpbmUsIGNvbHVtbiwgc3JjRmlsZSwgY2h1bmtzKSB7XG4gICAgdGhpcy5zcmMgPSAnJztcbiAgICBpZiAoY2h1bmtzKSB7XG4gICAgICB0aGlzLmFkZChjaHVua3MpO1xuICAgIH1cbiAgfTtcbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUgPSB7XG4gICAgYWRkOiBmdW5jdGlvbihjaHVua3MpIHtcbiAgICAgIGlmIChpc0FycmF5KGNodW5rcykpIHtcbiAgICAgICAgY2h1bmtzID0gY2h1bmtzLmpvaW4oJycpO1xuICAgICAgfVxuICAgICAgdGhpcy5zcmMgKz0gY2h1bmtzO1xuICAgIH0sXG4gICAgcHJlcGVuZDogZnVuY3Rpb24oY2h1bmtzKSB7XG4gICAgICBpZiAoaXNBcnJheShjaHVua3MpKSB7XG4gICAgICAgIGNodW5rcyA9IGNodW5rcy5qb2luKCcnKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc3JjID0gY2h1bmtzICsgdGhpcy5zcmM7XG4gICAgfSxcbiAgICB0b1N0cmluZ1dpdGhTb3VyY2VNYXA6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHtjb2RlOiB0aGlzLnRvU3RyaW5nKCl9O1xuICAgIH0sXG4gICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc3JjO1xuICAgIH1cbiAgfTtcbn1cblxuXG5mdW5jdGlvbiBjYXN0Q2h1bmsoY2h1bmssIGNvZGVHZW4sIGxvYykge1xuICBpZiAoaXNBcnJheShjaHVuaykpIHtcbiAgICBsZXQgcmV0ID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gY2h1bmsubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHJldC5wdXNoKGNvZGVHZW4ud3JhcChjaHVua1tpXSwgbG9jKSk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNodW5rID09PSAnYm9vbGVhbicgfHwgdHlwZW9mIGNodW5rID09PSAnbnVtYmVyJykge1xuICAgIC8vIEhhbmRsZSBwcmltaXRpdmVzIHRoYXQgdGhlIFNvdXJjZU5vZGUgd2lsbCB0aHJvdyB1cCBvblxuICAgIHJldHVybiBjaHVuayArICcnO1xuICB9XG4gIHJldHVybiBjaHVuaztcbn1cblxuXG5mdW5jdGlvbiBDb2RlR2VuKHNyY0ZpbGUpIHtcbiAgdGhpcy5zcmNGaWxlID0gc3JjRmlsZTtcbiAgdGhpcy5zb3VyY2UgPSBbXTtcbn1cblxuQ29kZUdlbi5wcm90b3R5cGUgPSB7XG4gIGlzRW1wdHkoKSB7XG4gICAgcmV0dXJuICF0aGlzLnNvdXJjZS5sZW5ndGg7XG4gIH0sXG4gIHByZXBlbmQ6IGZ1bmN0aW9uKHNvdXJjZSwgbG9jKSB7XG4gICAgdGhpcy5zb3VyY2UudW5zaGlmdCh0aGlzLndyYXAoc291cmNlLCBsb2MpKTtcbiAgfSxcbiAgcHVzaDogZnVuY3Rpb24oc291cmNlLCBsb2MpIHtcbiAgICB0aGlzLnNvdXJjZS5wdXNoKHRoaXMud3JhcChzb3VyY2UsIGxvYykpO1xuICB9LFxuXG4gIG1lcmdlOiBmdW5jdGlvbigpIHtcbiAgICBsZXQgc291cmNlID0gdGhpcy5lbXB0eSgpO1xuICAgIHRoaXMuZWFjaChmdW5jdGlvbihsaW5lKSB7XG4gICAgICBzb3VyY2UuYWRkKFsnICAnLCBsaW5lLCAnXFxuJ10pO1xuICAgIH0pO1xuICAgIHJldHVybiBzb3VyY2U7XG4gIH0sXG5cbiAgZWFjaDogZnVuY3Rpb24oaXRlcikge1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLnNvdXJjZS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgaXRlcih0aGlzLnNvdXJjZVtpXSk7XG4gICAgfVxuICB9LFxuXG4gIGVtcHR5OiBmdW5jdGlvbigpIHtcbiAgICBsZXQgbG9jID0gdGhpcy5jdXJyZW50TG9jYXRpb24gfHwge3N0YXJ0OiB7fX07XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VOb2RlKGxvYy5zdGFydC5saW5lLCBsb2Muc3RhcnQuY29sdW1uLCB0aGlzLnNyY0ZpbGUpO1xuICB9LFxuICB3cmFwOiBmdW5jdGlvbihjaHVuaywgbG9jID0gdGhpcy5jdXJyZW50TG9jYXRpb24gfHwge3N0YXJ0OiB7fX0pIHtcbiAgICBpZiAoY2h1bmsgaW5zdGFuY2VvZiBTb3VyY2VOb2RlKSB7XG4gICAgICByZXR1cm4gY2h1bms7XG4gICAgfVxuXG4gICAgY2h1bmsgPSBjYXN0Q2h1bmsoY2h1bmssIHRoaXMsIGxvYyk7XG5cbiAgICByZXR1cm4gbmV3IFNvdXJjZU5vZGUobG9jLnN0YXJ0LmxpbmUsIGxvYy5zdGFydC5jb2x1bW4sIHRoaXMuc3JjRmlsZSwgY2h1bmspO1xuICB9LFxuXG4gIGZ1bmN0aW9uQ2FsbDogZnVuY3Rpb24oZm4sIHR5cGUsIHBhcmFtcykge1xuICAgIHBhcmFtcyA9IHRoaXMuZ2VuZXJhdGVMaXN0KHBhcmFtcyk7XG4gICAgcmV0dXJuIHRoaXMud3JhcChbZm4sIHR5cGUgPyAnLicgKyB0eXBlICsgJygnIDogJygnLCBwYXJhbXMsICcpJ10pO1xuICB9LFxuXG4gIHF1b3RlZFN0cmluZzogZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuICdcIicgKyAoc3RyICsgJycpXG4gICAgICAucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKVxuICAgICAgLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKVxuICAgICAgLnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKVxuICAgICAgLnJlcGxhY2UoL1xcci9nLCAnXFxcXHInKVxuICAgICAgLnJlcGxhY2UoL1xcdTIwMjgvZywgJ1xcXFx1MjAyOCcpICAgLy8gUGVyIEVjbWEtMjYyIDcuMyArIDcuOC40XG4gICAgICAucmVwbGFjZSgvXFx1MjAyOS9nLCAnXFxcXHUyMDI5JykgKyAnXCInO1xuICB9LFxuXG4gIG9iamVjdExpdGVyYWw6IGZ1bmN0aW9uKG9iaikge1xuICAgIGxldCBwYWlycyA9IFtdO1xuXG4gICAgZm9yIChsZXQga2V5IGluIG9iaikge1xuICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IGNhc3RDaHVuayhvYmpba2V5XSwgdGhpcyk7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBwYWlycy5wdXNoKFt0aGlzLnF1b3RlZFN0cmluZyhrZXkpLCAnOicsIHZhbHVlXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgcmV0ID0gdGhpcy5nZW5lcmF0ZUxpc3QocGFpcnMpO1xuICAgIHJldC5wcmVwZW5kKCd7Jyk7XG4gICAgcmV0LmFkZCgnfScpO1xuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cblxuICBnZW5lcmF0ZUxpc3Q6IGZ1bmN0aW9uKGVudHJpZXMpIHtcbiAgICBsZXQgcmV0ID0gdGhpcy5lbXB0eSgpO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGVudHJpZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmIChpKSB7XG4gICAgICAgIHJldC5hZGQoJywnKTtcbiAgICAgIH1cblxuICAgICAgcmV0LmFkZChjYXN0Q2h1bmsoZW50cmllc1tpXSwgdGhpcykpO1xuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cbiAgZ2VuZXJhdGVBcnJheTogZnVuY3Rpb24oZW50cmllcykge1xuICAgIGxldCByZXQgPSB0aGlzLmdlbmVyYXRlTGlzdChlbnRyaWVzKTtcbiAgICByZXQucHJlcGVuZCgnWycpO1xuICAgIHJldC5hZGQoJ10nKTtcblxuICAgIHJldHVybiByZXQ7XG4gIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IENvZGVHZW47XG5cbiIsIi8qIGVzbGludC1kaXNhYmxlIG5ldy1jYXAgKi9cblxuaW1wb3J0IEV4Y2VwdGlvbiBmcm9tICcuLi9leGNlcHRpb24nO1xuaW1wb3J0IHtpc0FycmF5LCBpbmRleE9mLCBleHRlbmR9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBBU1QgZnJvbSAnLi9hc3QnO1xuXG5jb25zdCBzbGljZSA9IFtdLnNsaWNlO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29tcGlsZXIoKSB7fVxuXG4vLyB0aGUgZm91bmRIZWxwZXIgcmVnaXN0ZXIgd2lsbCBkaXNhbWJpZ3VhdGUgaGVscGVyIGxvb2t1cCBmcm9tIGZpbmRpbmcgYVxuLy8gZnVuY3Rpb24gaW4gYSBjb250ZXh0LiBUaGlzIGlzIG5lY2Vzc2FyeSBmb3IgbXVzdGFjaGUgY29tcGF0aWJpbGl0eSwgd2hpY2hcbi8vIHJlcXVpcmVzIHRoYXQgY29udGV4dCBmdW5jdGlvbnMgaW4gYmxvY2tzIGFyZSBldmFsdWF0ZWQgYnkgYmxvY2tIZWxwZXJNaXNzaW5nLFxuLy8gYW5kIHRoZW4gcHJvY2VlZCBhcyBpZiB0aGUgcmVzdWx0aW5nIHZhbHVlIHdhcyBwcm92aWRlZCB0byBibG9ja0hlbHBlck1pc3NpbmcuXG5cbkNvbXBpbGVyLnByb3RvdHlwZSA9IHtcbiAgY29tcGlsZXI6IENvbXBpbGVyLFxuXG4gIGVxdWFsczogZnVuY3Rpb24ob3RoZXIpIHtcbiAgICBsZXQgbGVuID0gdGhpcy5vcGNvZGVzLmxlbmd0aDtcbiAgICBpZiAob3RoZXIub3Bjb2Rlcy5sZW5ndGggIT09IGxlbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGxldCBvcGNvZGUgPSB0aGlzLm9wY29kZXNbaV0sXG4gICAgICAgICAgb3RoZXJPcGNvZGUgPSBvdGhlci5vcGNvZGVzW2ldO1xuICAgICAgaWYgKG9wY29kZS5vcGNvZGUgIT09IG90aGVyT3Bjb2RlLm9wY29kZSB8fCAhYXJnRXF1YWxzKG9wY29kZS5hcmdzLCBvdGhlck9wY29kZS5hcmdzKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2Uga25vdyB0aGF0IGxlbmd0aCBpcyB0aGUgc2FtZSBiZXR3ZWVuIHRoZSB0d28gYXJyYXlzIGJlY2F1c2UgdGhleSBhcmUgZGlyZWN0bHkgdGllZFxuICAgIC8vIHRvIHRoZSBvcGNvZGUgYmVoYXZpb3IgYWJvdmUuXG4gICAgbGVuID0gdGhpcy5jaGlsZHJlbi5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKCF0aGlzLmNoaWxkcmVuW2ldLmVxdWFscyhvdGhlci5jaGlsZHJlbltpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuXG4gIGd1aWQ6IDAsXG5cbiAgY29tcGlsZTogZnVuY3Rpb24ocHJvZ3JhbSwgb3B0aW9ucykge1xuICAgIHRoaXMuc291cmNlTm9kZSA9IFtdO1xuICAgIHRoaXMub3Bjb2RlcyA9IFtdO1xuICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuc3RyaW5nUGFyYW1zID0gb3B0aW9ucy5zdHJpbmdQYXJhbXM7XG4gICAgdGhpcy50cmFja0lkcyA9IG9wdGlvbnMudHJhY2tJZHM7XG5cbiAgICBvcHRpb25zLmJsb2NrUGFyYW1zID0gb3B0aW9ucy5ibG9ja1BhcmFtcyB8fCBbXTtcblxuICAgIC8vIFRoZXNlIGNoYW5nZXMgd2lsbCBwcm9wYWdhdGUgdG8gdGhlIG90aGVyIGNvbXBpbGVyIGNvbXBvbmVudHNcbiAgICBsZXQga25vd25IZWxwZXJzID0gb3B0aW9ucy5rbm93bkhlbHBlcnM7XG4gICAgb3B0aW9ucy5rbm93bkhlbHBlcnMgPSB7XG4gICAgICAnaGVscGVyTWlzc2luZyc6IHRydWUsXG4gICAgICAnYmxvY2tIZWxwZXJNaXNzaW5nJzogdHJ1ZSxcbiAgICAgICdlYWNoJzogdHJ1ZSxcbiAgICAgICdpZic6IHRydWUsXG4gICAgICAndW5sZXNzJzogdHJ1ZSxcbiAgICAgICd3aXRoJzogdHJ1ZSxcbiAgICAgICdsb2cnOiB0cnVlLFxuICAgICAgJ2xvb2t1cCc6IHRydWVcbiAgICB9O1xuICAgIGlmIChrbm93bkhlbHBlcnMpIHtcbiAgICAgIGZvciAobGV0IG5hbWUgaW4ga25vd25IZWxwZXJzKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgICAgIGlmIChuYW1lIGluIGtub3duSGVscGVycykge1xuICAgICAgICAgIHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0gPSBrbm93bkhlbHBlcnNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hY2NlcHQocHJvZ3JhbSk7XG4gIH0sXG5cbiAgY29tcGlsZVByb2dyYW06IGZ1bmN0aW9uKHByb2dyYW0pIHtcbiAgICBsZXQgY2hpbGRDb21waWxlciA9IG5ldyB0aGlzLmNvbXBpbGVyKCksIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbmV3LWNhcFxuICAgICAgICByZXN1bHQgPSBjaGlsZENvbXBpbGVyLmNvbXBpbGUocHJvZ3JhbSwgdGhpcy5vcHRpb25zKSxcbiAgICAgICAgZ3VpZCA9IHRoaXMuZ3VpZCsrO1xuXG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdGhpcy51c2VQYXJ0aWFsIHx8IHJlc3VsdC51c2VQYXJ0aWFsO1xuXG4gICAgdGhpcy5jaGlsZHJlbltndWlkXSA9IHJlc3VsdDtcbiAgICB0aGlzLnVzZURlcHRocyA9IHRoaXMudXNlRGVwdGhzIHx8IHJlc3VsdC51c2VEZXB0aHM7XG5cbiAgICByZXR1cm4gZ3VpZDtcbiAgfSxcblxuICBhY2NlcHQ6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dDogU2FuaXR5IGNvZGUgKi9cbiAgICBpZiAoIXRoaXNbbm9kZS50eXBlXSkge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignVW5rbm93biB0eXBlOiAnICsgbm9kZS50eXBlLCBub2RlKTtcbiAgICB9XG5cbiAgICB0aGlzLnNvdXJjZU5vZGUudW5zaGlmdChub2RlKTtcbiAgICBsZXQgcmV0ID0gdGhpc1tub2RlLnR5cGVdKG5vZGUpO1xuICAgIHRoaXMuc291cmNlTm9kZS5zaGlmdCgpO1xuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cbiAgUHJvZ3JhbTogZnVuY3Rpb24ocHJvZ3JhbSkge1xuICAgIHRoaXMub3B0aW9ucy5ibG9ja1BhcmFtcy51bnNoaWZ0KHByb2dyYW0uYmxvY2tQYXJhbXMpO1xuXG4gICAgbGV0IGJvZHkgPSBwcm9ncmFtLmJvZHksXG4gICAgICAgIGJvZHlMZW5ndGggPSBib2R5Lmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJvZHlMZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5hY2NlcHQoYm9keVtpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5vcHRpb25zLmJsb2NrUGFyYW1zLnNoaWZ0KCk7XG5cbiAgICB0aGlzLmlzU2ltcGxlID0gYm9keUxlbmd0aCA9PT0gMTtcbiAgICB0aGlzLmJsb2NrUGFyYW1zID0gcHJvZ3JhbS5ibG9ja1BhcmFtcyA/IHByb2dyYW0uYmxvY2tQYXJhbXMubGVuZ3RoIDogMDtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIEJsb2NrU3RhdGVtZW50OiBmdW5jdGlvbihibG9jaykge1xuICAgIHRyYW5zZm9ybUxpdGVyYWxUb1BhdGgoYmxvY2spO1xuXG4gICAgbGV0IHByb2dyYW0gPSBibG9jay5wcm9ncmFtLFxuICAgICAgICBpbnZlcnNlID0gYmxvY2suaW52ZXJzZTtcblxuICAgIHByb2dyYW0gPSBwcm9ncmFtICYmIHRoaXMuY29tcGlsZVByb2dyYW0ocHJvZ3JhbSk7XG4gICAgaW52ZXJzZSA9IGludmVyc2UgJiYgdGhpcy5jb21waWxlUHJvZ3JhbShpbnZlcnNlKTtcblxuICAgIGxldCB0eXBlID0gdGhpcy5jbGFzc2lmeVNleHByKGJsb2NrKTtcblxuICAgIGlmICh0eXBlID09PSAnaGVscGVyJykge1xuICAgICAgdGhpcy5oZWxwZXJTZXhwcihibG9jaywgcHJvZ3JhbSwgaW52ZXJzZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnc2ltcGxlJykge1xuICAgICAgdGhpcy5zaW1wbGVTZXhwcihibG9jayk7XG5cbiAgICAgIC8vIG5vdyB0aGF0IHRoZSBzaW1wbGUgbXVzdGFjaGUgaXMgcmVzb2x2ZWQsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGV2YWx1YXRlIGl0IGJ5IGV4ZWN1dGluZyBgYmxvY2tIZWxwZXJNaXNzaW5nYFxuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdibG9ja1ZhbHVlJywgYmxvY2sucGF0aC5vcmlnaW5hbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYW1iaWd1b3VzU2V4cHIoYmxvY2ssIHByb2dyYW0sIGludmVyc2UpO1xuXG4gICAgICAvLyBub3cgdGhhdCB0aGUgc2ltcGxlIG11c3RhY2hlIGlzIHJlc29sdmVkLCB3ZSBuZWVkIHRvXG4gICAgICAvLyBldmFsdWF0ZSBpdCBieSBleGVjdXRpbmcgYGJsb2NrSGVscGVyTWlzc2luZ2BcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgaW52ZXJzZSk7XG4gICAgICB0aGlzLm9wY29kZSgnZW1wdHlIYXNoJyk7XG4gICAgICB0aGlzLm9wY29kZSgnYW1iaWd1b3VzQmxvY2tWYWx1ZScpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdhcHBlbmQnKTtcbiAgfSxcblxuICBEZWNvcmF0b3JCbG9jayhkZWNvcmF0b3IpIHtcbiAgICBsZXQgcHJvZ3JhbSA9IGRlY29yYXRvci5wcm9ncmFtICYmIHRoaXMuY29tcGlsZVByb2dyYW0oZGVjb3JhdG9yLnByb2dyYW0pO1xuICAgIGxldCBwYXJhbXMgPSB0aGlzLnNldHVwRnVsbE11c3RhY2hlUGFyYW1zKGRlY29yYXRvciwgcHJvZ3JhbSwgdW5kZWZpbmVkKSxcbiAgICAgICAgcGF0aCA9IGRlY29yYXRvci5wYXRoO1xuXG4gICAgdGhpcy51c2VEZWNvcmF0b3JzID0gdHJ1ZTtcbiAgICB0aGlzLm9wY29kZSgncmVnaXN0ZXJEZWNvcmF0b3InLCBwYXJhbXMubGVuZ3RoLCBwYXRoLm9yaWdpbmFsKTtcbiAgfSxcblxuICBQYXJ0aWFsU3RhdGVtZW50OiBmdW5jdGlvbihwYXJ0aWFsKSB7XG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdHJ1ZTtcblxuICAgIGxldCBwcm9ncmFtID0gcGFydGlhbC5wcm9ncmFtO1xuICAgIGlmIChwcm9ncmFtKSB7XG4gICAgICBwcm9ncmFtID0gdGhpcy5jb21waWxlUHJvZ3JhbShwYXJ0aWFsLnByb2dyYW0pO1xuICAgIH1cblxuICAgIGxldCBwYXJhbXMgPSBwYXJ0aWFsLnBhcmFtcztcbiAgICBpZiAocGFyYW1zLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ1Vuc3VwcG9ydGVkIG51bWJlciBvZiBwYXJ0aWFsIGFyZ3VtZW50czogJyArIHBhcmFtcy5sZW5ndGgsIHBhcnRpYWwpO1xuICAgIH0gZWxzZSBpZiAoIXBhcmFtcy5sZW5ndGgpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZXhwbGljaXRQYXJ0aWFsQ29udGV4dCkge1xuICAgICAgICB0aGlzLm9wY29kZSgncHVzaExpdGVyYWwnLCAndW5kZWZpbmVkJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJhbXMucHVzaCh7dHlwZTogJ1BhdGhFeHByZXNzaW9uJywgcGFydHM6IFtdLCBkZXB0aDogMH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBwYXJ0aWFsTmFtZSA9IHBhcnRpYWwubmFtZS5vcmlnaW5hbCxcbiAgICAgICAgaXNEeW5hbWljID0gcGFydGlhbC5uYW1lLnR5cGUgPT09ICdTdWJFeHByZXNzaW9uJztcbiAgICBpZiAoaXNEeW5hbWljKSB7XG4gICAgICB0aGlzLmFjY2VwdChwYXJ0aWFsLm5hbWUpO1xuICAgIH1cblxuICAgIHRoaXMuc2V0dXBGdWxsTXVzdGFjaGVQYXJhbXMocGFydGlhbCwgcHJvZ3JhbSwgdW5kZWZpbmVkLCB0cnVlKTtcblxuICAgIGxldCBpbmRlbnQgPSBwYXJ0aWFsLmluZGVudCB8fCAnJztcbiAgICBpZiAodGhpcy5vcHRpb25zLnByZXZlbnRJbmRlbnQgJiYgaW5kZW50KSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kQ29udGVudCcsIGluZGVudCk7XG4gICAgICBpbmRlbnQgPSAnJztcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgnaW52b2tlUGFydGlhbCcsIGlzRHluYW1pYywgcGFydGlhbE5hbWUsIGluZGVudCk7XG4gICAgdGhpcy5vcGNvZGUoJ2FwcGVuZCcpO1xuICB9LFxuICBQYXJ0aWFsQmxvY2tTdGF0ZW1lbnQ6IGZ1bmN0aW9uKHBhcnRpYWxCbG9jaykge1xuICAgIHRoaXMuUGFydGlhbFN0YXRlbWVudChwYXJ0aWFsQmxvY2spO1xuICB9LFxuXG4gIE11c3RhY2hlU3RhdGVtZW50OiBmdW5jdGlvbihtdXN0YWNoZSkge1xuICAgIHRoaXMuU3ViRXhwcmVzc2lvbihtdXN0YWNoZSk7XG5cbiAgICBpZiAobXVzdGFjaGUuZXNjYXBlZCAmJiAhdGhpcy5vcHRpb25zLm5vRXNjYXBlKSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kRXNjYXBlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gICAgfVxuICB9LFxuICBEZWNvcmF0b3IoZGVjb3JhdG9yKSB7XG4gICAgdGhpcy5EZWNvcmF0b3JCbG9jayhkZWNvcmF0b3IpO1xuICB9LFxuXG5cbiAgQ29udGVudFN0YXRlbWVudDogZnVuY3Rpb24oY29udGVudCkge1xuICAgIGlmIChjb250ZW50LnZhbHVlKSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kQ29udGVudCcsIGNvbnRlbnQudmFsdWUpO1xuICAgIH1cbiAgfSxcblxuICBDb21tZW50U3RhdGVtZW50OiBmdW5jdGlvbigpIHt9LFxuXG4gIFN1YkV4cHJlc3Npb246IGZ1bmN0aW9uKHNleHByKSB7XG4gICAgdHJhbnNmb3JtTGl0ZXJhbFRvUGF0aChzZXhwcik7XG4gICAgbGV0IHR5cGUgPSB0aGlzLmNsYXNzaWZ5U2V4cHIoc2V4cHIpO1xuXG4gICAgaWYgKHR5cGUgPT09ICdzaW1wbGUnKSB7XG4gICAgICB0aGlzLnNpbXBsZVNleHByKHNleHByKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdoZWxwZXInKSB7XG4gICAgICB0aGlzLmhlbHBlclNleHByKHNleHByKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hbWJpZ3VvdXNTZXhwcihzZXhwcik7XG4gICAgfVxuICB9LFxuICBhbWJpZ3VvdXNTZXhwcjogZnVuY3Rpb24oc2V4cHIsIHByb2dyYW0sIGludmVyc2UpIHtcbiAgICBsZXQgcGF0aCA9IHNleHByLnBhdGgsXG4gICAgICAgIG5hbWUgPSBwYXRoLnBhcnRzWzBdLFxuICAgICAgICBpc0Jsb2NrID0gcHJvZ3JhbSAhPSBudWxsIHx8IGludmVyc2UgIT0gbnVsbDtcblxuICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgcGF0aC5kZXB0aCk7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcblxuICAgIHBhdGguc3RyaWN0ID0gdHJ1ZTtcbiAgICB0aGlzLmFjY2VwdChwYXRoKTtcblxuICAgIHRoaXMub3Bjb2RlKCdpbnZva2VBbWJpZ3VvdXMnLCBuYW1lLCBpc0Jsb2NrKTtcbiAgfSxcblxuICBzaW1wbGVTZXhwcjogZnVuY3Rpb24oc2V4cHIpIHtcbiAgICBsZXQgcGF0aCA9IHNleHByLnBhdGg7XG4gICAgcGF0aC5zdHJpY3QgPSB0cnVlO1xuICAgIHRoaXMuYWNjZXB0KHBhdGgpO1xuICAgIHRoaXMub3Bjb2RlKCdyZXNvbHZlUG9zc2libGVMYW1iZGEnKTtcbiAgfSxcblxuICBoZWxwZXJTZXhwcjogZnVuY3Rpb24oc2V4cHIsIHByb2dyYW0sIGludmVyc2UpIHtcbiAgICBsZXQgcGFyYW1zID0gdGhpcy5zZXR1cEZ1bGxNdXN0YWNoZVBhcmFtcyhzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSksXG4gICAgICAgIHBhdGggPSBzZXhwci5wYXRoLFxuICAgICAgICBuYW1lID0gcGF0aC5wYXJ0c1swXTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzW25hbWVdKSB7XG4gICAgICB0aGlzLm9wY29kZSgnaW52b2tlS25vd25IZWxwZXInLCBwYXJhbXMubGVuZ3RoLCBuYW1lKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNPbmx5KSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdZb3Ugc3BlY2lmaWVkIGtub3duSGVscGVyc09ubHksIGJ1dCB1c2VkIHRoZSB1bmtub3duIGhlbHBlciAnICsgbmFtZSwgc2V4cHIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXRoLnN0cmljdCA9IHRydWU7XG4gICAgICBwYXRoLmZhbHN5ID0gdHJ1ZTtcblxuICAgICAgdGhpcy5hY2NlcHQocGF0aCk7XG4gICAgICB0aGlzLm9wY29kZSgnaW52b2tlSGVscGVyJywgcGFyYW1zLmxlbmd0aCwgcGF0aC5vcmlnaW5hbCwgQVNULmhlbHBlcnMuc2ltcGxlSWQocGF0aCkpO1xuICAgIH1cbiAgfSxcblxuICBQYXRoRXhwcmVzc2lvbjogZnVuY3Rpb24ocGF0aCkge1xuICAgIHRoaXMuYWRkRGVwdGgocGF0aC5kZXB0aCk7XG4gICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBwYXRoLmRlcHRoKTtcblxuICAgIGxldCBuYW1lID0gcGF0aC5wYXJ0c1swXSxcbiAgICAgICAgc2NvcGVkID0gQVNULmhlbHBlcnMuc2NvcGVkSWQocGF0aCksXG4gICAgICAgIGJsb2NrUGFyYW1JZCA9ICFwYXRoLmRlcHRoICYmICFzY29wZWQgJiYgdGhpcy5ibG9ja1BhcmFtSW5kZXgobmFtZSk7XG5cbiAgICBpZiAoYmxvY2tQYXJhbUlkKSB7XG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwQmxvY2tQYXJhbScsIGJsb2NrUGFyYW1JZCwgcGF0aC5wYXJ0cyk7XG4gICAgfSBlbHNlIGlmICghbmFtZSkge1xuICAgICAgLy8gQ29udGV4dCByZWZlcmVuY2UsIGkuZS4gYHt7Zm9vIC59fWAgb3IgYHt7Zm9vIC4ufX1gXG4gICAgICB0aGlzLm9wY29kZSgncHVzaENvbnRleHQnKTtcbiAgICB9IGVsc2UgaWYgKHBhdGguZGF0YSkge1xuICAgICAgdGhpcy5vcHRpb25zLmRhdGEgPSB0cnVlO1xuICAgICAgdGhpcy5vcGNvZGUoJ2xvb2t1cERhdGEnLCBwYXRoLmRlcHRoLCBwYXRoLnBhcnRzLCBwYXRoLnN0cmljdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdsb29rdXBPbkNvbnRleHQnLCBwYXRoLnBhcnRzLCBwYXRoLmZhbHN5LCBwYXRoLnN0cmljdCwgc2NvcGVkKTtcbiAgICB9XG4gIH0sXG5cbiAgU3RyaW5nTGl0ZXJhbDogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hTdHJpbmcnLCBzdHJpbmcudmFsdWUpO1xuICB9LFxuXG4gIE51bWJlckxpdGVyYWw6IGZ1bmN0aW9uKG51bWJlcikge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsIG51bWJlci52YWx1ZSk7XG4gIH0sXG5cbiAgQm9vbGVhbkxpdGVyYWw6IGZ1bmN0aW9uKGJvb2wpIHtcbiAgICB0aGlzLm9wY29kZSgncHVzaExpdGVyYWwnLCBib29sLnZhbHVlKTtcbiAgfSxcblxuICBVbmRlZmluZWRMaXRlcmFsOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9wY29kZSgncHVzaExpdGVyYWwnLCAndW5kZWZpbmVkJyk7XG4gIH0sXG5cbiAgTnVsbExpdGVyYWw6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsICdudWxsJyk7XG4gIH0sXG5cbiAgSGFzaDogZnVuY3Rpb24oaGFzaCkge1xuICAgIGxldCBwYWlycyA9IGhhc2gucGFpcnMsXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBsID0gcGFpcnMubGVuZ3RoO1xuXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hIYXNoJyk7XG5cbiAgICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgICAgdGhpcy5wdXNoUGFyYW0ocGFpcnNbaV0udmFsdWUpO1xuICAgIH1cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXNzaWduVG9IYXNoJywgcGFpcnNbaV0ua2V5KTtcbiAgICB9XG4gICAgdGhpcy5vcGNvZGUoJ3BvcEhhc2gnKTtcbiAgfSxcblxuICAvLyBIRUxQRVJTXG4gIG9wY29kZTogZnVuY3Rpb24obmFtZSkge1xuICAgIHRoaXMub3Bjb2Rlcy5wdXNoKHsgb3Bjb2RlOiBuYW1lLCBhcmdzOiBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksIGxvYzogdGhpcy5zb3VyY2VOb2RlWzBdLmxvYyB9KTtcbiAgfSxcblxuICBhZGREZXB0aDogZnVuY3Rpb24oZGVwdGgpIHtcbiAgICBpZiAoIWRlcHRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy51c2VEZXB0aHMgPSB0cnVlO1xuICB9LFxuXG4gIGNsYXNzaWZ5U2V4cHI6IGZ1bmN0aW9uKHNleHByKSB7XG4gICAgbGV0IGlzU2ltcGxlID0gQVNULmhlbHBlcnMuc2ltcGxlSWQoc2V4cHIucGF0aCk7XG5cbiAgICBsZXQgaXNCbG9ja1BhcmFtID0gaXNTaW1wbGUgJiYgISF0aGlzLmJsb2NrUGFyYW1JbmRleChzZXhwci5wYXRoLnBhcnRzWzBdKTtcblxuICAgIC8vIGEgbXVzdGFjaGUgaXMgYW4gZWxpZ2libGUgaGVscGVyIGlmOlxuICAgIC8vICogaXRzIGlkIGlzIHNpbXBsZSAoYSBzaW5nbGUgcGFydCwgbm90IGB0aGlzYCBvciBgLi5gKVxuICAgIGxldCBpc0hlbHBlciA9ICFpc0Jsb2NrUGFyYW0gJiYgQVNULmhlbHBlcnMuaGVscGVyRXhwcmVzc2lvbihzZXhwcik7XG5cbiAgICAvLyBpZiBhIG11c3RhY2hlIGlzIGFuIGVsaWdpYmxlIGhlbHBlciBidXQgbm90IGEgZGVmaW5pdGVcbiAgICAvLyBoZWxwZXIsIGl0IGlzIGFtYmlndW91cywgYW5kIHdpbGwgYmUgcmVzb2x2ZWQgaW4gYSBsYXRlclxuICAgIC8vIHBhc3Mgb3IgYXQgcnVudGltZS5cbiAgICBsZXQgaXNFbGlnaWJsZSA9ICFpc0Jsb2NrUGFyYW0gJiYgKGlzSGVscGVyIHx8IGlzU2ltcGxlKTtcblxuICAgIC8vIGlmIGFtYmlndW91cywgd2UgY2FuIHBvc3NpYmx5IHJlc29sdmUgdGhlIGFtYmlndWl0eSBub3dcbiAgICAvLyBBbiBlbGlnaWJsZSBoZWxwZXIgaXMgb25lIHRoYXQgZG9lcyBub3QgaGF2ZSBhIGNvbXBsZXggcGF0aCwgaS5lLiBgdGhpcy5mb29gLCBgLi4vZm9vYCBldGMuXG4gICAgaWYgKGlzRWxpZ2libGUgJiYgIWlzSGVscGVyKSB7XG4gICAgICBsZXQgbmFtZSA9IHNleHByLnBhdGgucGFydHNbMF0sXG4gICAgICAgICAgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcblxuICAgICAgaWYgKG9wdGlvbnMua25vd25IZWxwZXJzW25hbWVdKSB7XG4gICAgICAgIGlzSGVscGVyID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5rbm93bkhlbHBlcnNPbmx5KSB7XG4gICAgICAgIGlzRWxpZ2libGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaXNIZWxwZXIpIHtcbiAgICAgIHJldHVybiAnaGVscGVyJztcbiAgICB9IGVsc2UgaWYgKGlzRWxpZ2libGUpIHtcbiAgICAgIHJldHVybiAnYW1iaWd1b3VzJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdzaW1wbGUnO1xuICAgIH1cbiAgfSxcblxuICBwdXNoUGFyYW1zOiBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IHBhcmFtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHRoaXMucHVzaFBhcmFtKHBhcmFtc1tpXSk7XG4gICAgfVxuICB9LFxuXG4gIHB1c2hQYXJhbTogZnVuY3Rpb24odmFsKSB7XG4gICAgbGV0IHZhbHVlID0gdmFsLnZhbHVlICE9IG51bGwgPyB2YWwudmFsdWUgOiB2YWwub3JpZ2luYWwgfHwgJyc7XG5cbiAgICBpZiAodGhpcy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIGlmICh2YWx1ZS5yZXBsYWNlKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWVcbiAgICAgICAgICAgIC5yZXBsYWNlKC9eKFxcLj9cXC5cXC8pKi9nLCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXC8vZywgJy4nKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHZhbC5kZXB0aCkge1xuICAgICAgICB0aGlzLmFkZERlcHRoKHZhbC5kZXB0aCk7XG4gICAgICB9XG4gICAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIHZhbC5kZXB0aCB8fCAwKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoU3RyaW5nUGFyYW0nLCB2YWx1ZSwgdmFsLnR5cGUpO1xuXG4gICAgICBpZiAodmFsLnR5cGUgPT09ICdTdWJFeHByZXNzaW9uJykge1xuICAgICAgICAvLyBTdWJFeHByZXNzaW9ucyBnZXQgZXZhbHVhdGVkIGFuZCBwYXNzZWQgaW5cbiAgICAgICAgLy8gaW4gc3RyaW5nIHBhcmFtcyBtb2RlLlxuICAgICAgICB0aGlzLmFjY2VwdCh2YWwpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhpcy50cmFja0lkcykge1xuICAgICAgICBsZXQgYmxvY2tQYXJhbUluZGV4O1xuICAgICAgICBpZiAodmFsLnBhcnRzICYmICFBU1QuaGVscGVycy5zY29wZWRJZCh2YWwpICYmICF2YWwuZGVwdGgpIHtcbiAgICAgICAgICAgYmxvY2tQYXJhbUluZGV4ID0gdGhpcy5ibG9ja1BhcmFtSW5kZXgodmFsLnBhcnRzWzBdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYmxvY2tQYXJhbUluZGV4KSB7XG4gICAgICAgICAgbGV0IGJsb2NrUGFyYW1DaGlsZCA9IHZhbC5wYXJ0cy5zbGljZSgxKS5qb2luKCcuJyk7XG4gICAgICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hJZCcsICdCbG9ja1BhcmFtJywgYmxvY2tQYXJhbUluZGV4LCBibG9ja1BhcmFtQ2hpbGQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gdmFsLm9yaWdpbmFsIHx8IHZhbHVlO1xuICAgICAgICAgIGlmICh2YWx1ZS5yZXBsYWNlKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHZhbHVlXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL150aGlzKD86XFwufCQpLywgJycpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL15cXC5cXC8vLCAnJylcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvXlxcLiQvLCAnJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hJZCcsIHZhbC50eXBlLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuYWNjZXB0KHZhbCk7XG4gICAgfVxuICB9LFxuXG4gIHNldHVwRnVsbE11c3RhY2hlUGFyYW1zOiBmdW5jdGlvbihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSwgb21pdEVtcHR5KSB7XG4gICAgbGV0IHBhcmFtcyA9IHNleHByLnBhcmFtcztcbiAgICB0aGlzLnB1c2hQYXJhbXMocGFyYW1zKTtcblxuICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIGludmVyc2UpO1xuXG4gICAgaWYgKHNleHByLmhhc2gpIHtcbiAgICAgIHRoaXMuYWNjZXB0KHNleHByLmhhc2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnZW1wdHlIYXNoJywgb21pdEVtcHR5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyYW1zO1xuICB9LFxuXG4gIGJsb2NrUGFyYW1JbmRleDogZnVuY3Rpb24obmFtZSkge1xuICAgIGZvciAobGV0IGRlcHRoID0gMCwgbGVuID0gdGhpcy5vcHRpb25zLmJsb2NrUGFyYW1zLmxlbmd0aDsgZGVwdGggPCBsZW47IGRlcHRoKyspIHtcbiAgICAgIGxldCBibG9ja1BhcmFtcyA9IHRoaXMub3B0aW9ucy5ibG9ja1BhcmFtc1tkZXB0aF0sXG4gICAgICAgICAgcGFyYW0gPSBibG9ja1BhcmFtcyAmJiBpbmRleE9mKGJsb2NrUGFyYW1zLCBuYW1lKTtcbiAgICAgIGlmIChibG9ja1BhcmFtcyAmJiBwYXJhbSA+PSAwKSB7XG4gICAgICAgIHJldHVybiBbZGVwdGgsIHBhcmFtXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVjb21waWxlKGlucHV0LCBvcHRpb25zLCBlbnYpIHtcbiAgaWYgKGlucHV0ID09IG51bGwgfHwgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycgJiYgaW5wdXQudHlwZSAhPT0gJ1Byb2dyYW0nKSkge1xuICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ1lvdSBtdXN0IHBhc3MgYSBzdHJpbmcgb3IgSGFuZGxlYmFycyBBU1QgdG8gSGFuZGxlYmFycy5wcmVjb21waWxlLiBZb3UgcGFzc2VkICcgKyBpbnB1dCk7XG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKCEoJ2RhdGEnIGluIG9wdGlvbnMpKSB7XG4gICAgb3B0aW9ucy5kYXRhID0gdHJ1ZTtcbiAgfVxuICBpZiAob3B0aW9ucy5jb21wYXQpIHtcbiAgICBvcHRpb25zLnVzZURlcHRocyA9IHRydWU7XG4gIH1cblxuICBsZXQgYXN0ID0gZW52LnBhcnNlKGlucHV0LCBvcHRpb25zKSxcbiAgICAgIGVudmlyb25tZW50ID0gbmV3IGVudi5Db21waWxlcigpLmNvbXBpbGUoYXN0LCBvcHRpb25zKTtcbiAgcmV0dXJuIG5ldyBlbnYuSmF2YVNjcmlwdENvbXBpbGVyKCkuY29tcGlsZShlbnZpcm9ubWVudCwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlKGlucHV0LCBvcHRpb25zID0ge30sIGVudikge1xuICBpZiAoaW5wdXQgPT0gbnVsbCB8fCAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJyAmJiBpbnB1dC50eXBlICE9PSAnUHJvZ3JhbScpKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignWW91IG11c3QgcGFzcyBhIHN0cmluZyBvciBIYW5kbGViYXJzIEFTVCB0byBIYW5kbGViYXJzLmNvbXBpbGUuIFlvdSBwYXNzZWQgJyArIGlucHV0KTtcbiAgfVxuXG4gIG9wdGlvbnMgPSBleHRlbmQoe30sIG9wdGlvbnMpO1xuICBpZiAoISgnZGF0YScgaW4gb3B0aW9ucykpIHtcbiAgICBvcHRpb25zLmRhdGEgPSB0cnVlO1xuICB9XG4gIGlmIChvcHRpb25zLmNvbXBhdCkge1xuICAgIG9wdGlvbnMudXNlRGVwdGhzID0gdHJ1ZTtcbiAgfVxuXG4gIGxldCBjb21waWxlZDtcblxuICBmdW5jdGlvbiBjb21waWxlSW5wdXQoKSB7XG4gICAgbGV0IGFzdCA9IGVudi5wYXJzZShpbnB1dCwgb3B0aW9ucyksXG4gICAgICAgIGVudmlyb25tZW50ID0gbmV3IGVudi5Db21waWxlcigpLmNvbXBpbGUoYXN0LCBvcHRpb25zKSxcbiAgICAgICAgdGVtcGxhdGVTcGVjID0gbmV3IGVudi5KYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKGVudmlyb25tZW50LCBvcHRpb25zLCB1bmRlZmluZWQsIHRydWUpO1xuICAgIHJldHVybiBlbnYudGVtcGxhdGUodGVtcGxhdGVTcGVjKTtcbiAgfVxuXG4gIC8vIFRlbXBsYXRlIGlzIG9ubHkgY29tcGlsZWQgb24gZmlyc3QgdXNlIGFuZCBjYWNoZWQgYWZ0ZXIgdGhhdCBwb2ludC5cbiAgZnVuY3Rpb24gcmV0KGNvbnRleHQsIGV4ZWNPcHRpb25zKSB7XG4gICAgaWYgKCFjb21waWxlZCkge1xuICAgICAgY29tcGlsZWQgPSBjb21waWxlSW5wdXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBpbGVkLmNhbGwodGhpcywgY29udGV4dCwgZXhlY09wdGlvbnMpO1xuICB9XG4gIHJldC5fc2V0dXAgPSBmdW5jdGlvbihzZXR1cE9wdGlvbnMpIHtcbiAgICBpZiAoIWNvbXBpbGVkKSB7XG4gICAgICBjb21waWxlZCA9IGNvbXBpbGVJbnB1dCgpO1xuICAgIH1cbiAgICByZXR1cm4gY29tcGlsZWQuX3NldHVwKHNldHVwT3B0aW9ucyk7XG4gIH07XG4gIHJldC5fY2hpbGQgPSBmdW5jdGlvbihpLCBkYXRhLCBibG9ja1BhcmFtcywgZGVwdGhzKSB7XG4gICAgaWYgKCFjb21waWxlZCkge1xuICAgICAgY29tcGlsZWQgPSBjb21waWxlSW5wdXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBpbGVkLl9jaGlsZChpLCBkYXRhLCBibG9ja1BhcmFtcywgZGVwdGhzKTtcbiAgfTtcbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gYXJnRXF1YWxzKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmIChpc0FycmF5KGEpICYmIGlzQXJyYXkoYikgJiYgYS5sZW5ndGggPT09IGIubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWFyZ0VxdWFscyhhW2ldLCBiW2ldKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUxpdGVyYWxUb1BhdGgoc2V4cHIpIHtcbiAgaWYgKCFzZXhwci5wYXRoLnBhcnRzKSB7XG4gICAgbGV0IGxpdGVyYWwgPSBzZXhwci5wYXRoO1xuICAgIC8vIENhc3RpbmcgdG8gc3RyaW5nIGhlcmUgdG8gbWFrZSBmYWxzZSBhbmQgMCBsaXRlcmFsIHZhbHVlcyBwbGF5IG5pY2VseSB3aXRoIHRoZSByZXN0XG4gICAgLy8gb2YgdGhlIHN5c3RlbS5cbiAgICBzZXhwci5wYXRoID0ge1xuICAgICAgdHlwZTogJ1BhdGhFeHByZXNzaW9uJyxcbiAgICAgIGRhdGE6IGZhbHNlLFxuICAgICAgZGVwdGg6IDAsXG4gICAgICBwYXJ0czogW2xpdGVyYWwub3JpZ2luYWwgKyAnJ10sXG4gICAgICBvcmlnaW5hbDogbGl0ZXJhbC5vcmlnaW5hbCArICcnLFxuICAgICAgbG9jOiBsaXRlcmFsLmxvY1xuICAgIH07XG4gIH1cbn1cbiIsImltcG9ydCBFeGNlcHRpb24gZnJvbSAnLi4vZXhjZXB0aW9uJztcblxuZnVuY3Rpb24gdmFsaWRhdGVDbG9zZShvcGVuLCBjbG9zZSkge1xuICBjbG9zZSA9IGNsb3NlLnBhdGggPyBjbG9zZS5wYXRoLm9yaWdpbmFsIDogY2xvc2U7XG5cbiAgaWYgKG9wZW4ucGF0aC5vcmlnaW5hbCAhPT0gY2xvc2UpIHtcbiAgICBsZXQgZXJyb3JOb2RlID0ge2xvYzogb3Blbi5wYXRoLmxvY307XG5cbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKG9wZW4ucGF0aC5vcmlnaW5hbCArIFwiIGRvZXNuJ3QgbWF0Y2ggXCIgKyBjbG9zZSwgZXJyb3JOb2RlKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gU291cmNlTG9jYXRpb24oc291cmNlLCBsb2NJbmZvKSB7XG4gIHRoaXMuc291cmNlID0gc291cmNlO1xuICB0aGlzLnN0YXJ0ID0ge1xuICAgIGxpbmU6IGxvY0luZm8uZmlyc3RfbGluZSxcbiAgICBjb2x1bW46IGxvY0luZm8uZmlyc3RfY29sdW1uXG4gIH07XG4gIHRoaXMuZW5kID0ge1xuICAgIGxpbmU6IGxvY0luZm8ubGFzdF9saW5lLFxuICAgIGNvbHVtbjogbG9jSW5mby5sYXN0X2NvbHVtblxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaWQodG9rZW4pIHtcbiAgaWYgKC9eXFxbLipcXF0kLy50ZXN0KHRva2VuKSkge1xuICAgIHJldHVybiB0b2tlbi5zdWJzdHIoMSwgdG9rZW4ubGVuZ3RoIC0gMik7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRva2VuO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcEZsYWdzKG9wZW4sIGNsb3NlKSB7XG4gIHJldHVybiB7XG4gICAgb3Blbjogb3Blbi5jaGFyQXQoMikgPT09ICd+JyxcbiAgICBjbG9zZTogY2xvc2UuY2hhckF0KGNsb3NlLmxlbmd0aCAtIDMpID09PSAnfidcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmlwQ29tbWVudChjb21tZW50KSB7XG4gIHJldHVybiBjb21tZW50LnJlcGxhY2UoL15cXHtcXHt+P1xcIS0/LT8vLCAnJylcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvLT8tP34/XFx9XFx9JC8sICcnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVQYXRoKGRhdGEsIHBhcnRzLCBsb2MpIHtcbiAgbG9jID0gdGhpcy5sb2NJbmZvKGxvYyk7XG5cbiAgbGV0IG9yaWdpbmFsID0gZGF0YSA/ICdAJyA6ICcnLFxuICAgICAgZGlnID0gW10sXG4gICAgICBkZXB0aCA9IDAsXG4gICAgICBkZXB0aFN0cmluZyA9ICcnO1xuXG4gIGZvciAobGV0IGkgPSAwLCBsID0gcGFydHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbGV0IHBhcnQgPSBwYXJ0c1tpXS5wYXJ0LFxuICAgICAgICAvLyBJZiB3ZSBoYXZlIFtdIHN5bnRheCB0aGVuIHdlIGRvIG5vdCB0cmVhdCBwYXRoIHJlZmVyZW5jZXMgYXMgb3BlcmF0b3JzLFxuICAgICAgICAvLyBpLmUuIGZvby5bdGhpc10gcmVzb2x2ZXMgdG8gYXBwcm94aW1hdGVseSBjb250ZXh0LmZvb1sndGhpcyddXG4gICAgICAgIGlzTGl0ZXJhbCA9IHBhcnRzW2ldLm9yaWdpbmFsICE9PSBwYXJ0O1xuICAgIG9yaWdpbmFsICs9IChwYXJ0c1tpXS5zZXBhcmF0b3IgfHwgJycpICsgcGFydDtcblxuICAgIGlmICghaXNMaXRlcmFsICYmIChwYXJ0ID09PSAnLi4nIHx8IHBhcnQgPT09ICcuJyB8fCBwYXJ0ID09PSAndGhpcycpKSB7XG4gICAgICBpZiAoZGlnLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignSW52YWxpZCBwYXRoOiAnICsgb3JpZ2luYWwsIHtsb2N9KTtcbiAgICAgIH0gZWxzZSBpZiAocGFydCA9PT0gJy4uJykge1xuICAgICAgICBkZXB0aCsrO1xuICAgICAgICBkZXB0aFN0cmluZyArPSAnLi4vJztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZGlnLnB1c2gocGFydCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnUGF0aEV4cHJlc3Npb24nLFxuICAgIGRhdGEsXG4gICAgZGVwdGgsXG4gICAgcGFydHM6IGRpZyxcbiAgICBvcmlnaW5hbCxcbiAgICBsb2NcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVNdXN0YWNoZShwYXRoLCBwYXJhbXMsIGhhc2gsIG9wZW4sIHN0cmlwLCBsb2NJbmZvKSB7XG4gIC8vIE11c3QgdXNlIGNoYXJBdCB0byBzdXBwb3J0IElFIHByZS0xMFxuICBsZXQgZXNjYXBlRmxhZyA9IG9wZW4uY2hhckF0KDMpIHx8IG9wZW4uY2hhckF0KDIpLFxuICAgICAgZXNjYXBlZCA9IGVzY2FwZUZsYWcgIT09ICd7JyAmJiBlc2NhcGVGbGFnICE9PSAnJic7XG5cbiAgbGV0IGRlY29yYXRvciA9ICgvXFwqLy50ZXN0KG9wZW4pKTtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBkZWNvcmF0b3IgPyAnRGVjb3JhdG9yJyA6ICdNdXN0YWNoZVN0YXRlbWVudCcsXG4gICAgcGF0aCxcbiAgICBwYXJhbXMsXG4gICAgaGFzaCxcbiAgICBlc2NhcGVkLFxuICAgIHN0cmlwLFxuICAgIGxvYzogdGhpcy5sb2NJbmZvKGxvY0luZm8pXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlUmF3QmxvY2sob3BlblJhd0Jsb2NrLCBjb250ZW50cywgY2xvc2UsIGxvY0luZm8pIHtcbiAgdmFsaWRhdGVDbG9zZShvcGVuUmF3QmxvY2ssIGNsb3NlKTtcblxuICBsb2NJbmZvID0gdGhpcy5sb2NJbmZvKGxvY0luZm8pO1xuICBsZXQgcHJvZ3JhbSA9IHtcbiAgICB0eXBlOiAnUHJvZ3JhbScsXG4gICAgYm9keTogY29udGVudHMsXG4gICAgc3RyaXA6IHt9LFxuICAgIGxvYzogbG9jSW5mb1xuICB9O1xuXG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0Jsb2NrU3RhdGVtZW50JyxcbiAgICBwYXRoOiBvcGVuUmF3QmxvY2sucGF0aCxcbiAgICBwYXJhbXM6IG9wZW5SYXdCbG9jay5wYXJhbXMsXG4gICAgaGFzaDogb3BlblJhd0Jsb2NrLmhhc2gsXG4gICAgcHJvZ3JhbSxcbiAgICBvcGVuU3RyaXA6IHt9LFxuICAgIGludmVyc2VTdHJpcDoge30sXG4gICAgY2xvc2VTdHJpcDoge30sXG4gICAgbG9jOiBsb2NJbmZvXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlQmxvY2sob3BlbkJsb2NrLCBwcm9ncmFtLCBpbnZlcnNlQW5kUHJvZ3JhbSwgY2xvc2UsIGludmVydGVkLCBsb2NJbmZvKSB7XG4gIGlmIChjbG9zZSAmJiBjbG9zZS5wYXRoKSB7XG4gICAgdmFsaWRhdGVDbG9zZShvcGVuQmxvY2ssIGNsb3NlKTtcbiAgfVxuXG4gIGxldCBkZWNvcmF0b3IgPSAoL1xcKi8udGVzdChvcGVuQmxvY2sub3BlbikpO1xuXG4gIHByb2dyYW0uYmxvY2tQYXJhbXMgPSBvcGVuQmxvY2suYmxvY2tQYXJhbXM7XG5cbiAgbGV0IGludmVyc2UsXG4gICAgICBpbnZlcnNlU3RyaXA7XG5cbiAgaWYgKGludmVyc2VBbmRQcm9ncmFtKSB7XG4gICAgaWYgKGRlY29yYXRvcikge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignVW5leHBlY3RlZCBpbnZlcnNlIGJsb2NrIG9uIGRlY29yYXRvcicsIGludmVyc2VBbmRQcm9ncmFtKTtcbiAgICB9XG5cbiAgICBpZiAoaW52ZXJzZUFuZFByb2dyYW0uY2hhaW4pIHtcbiAgICAgIGludmVyc2VBbmRQcm9ncmFtLnByb2dyYW0uYm9keVswXS5jbG9zZVN0cmlwID0gY2xvc2Uuc3RyaXA7XG4gICAgfVxuXG4gICAgaW52ZXJzZVN0cmlwID0gaW52ZXJzZUFuZFByb2dyYW0uc3RyaXA7XG4gICAgaW52ZXJzZSA9IGludmVyc2VBbmRQcm9ncmFtLnByb2dyYW07XG4gIH1cblxuICBpZiAoaW52ZXJ0ZWQpIHtcbiAgICBpbnZlcnRlZCA9IGludmVyc2U7XG4gICAgaW52ZXJzZSA9IHByb2dyYW07XG4gICAgcHJvZ3JhbSA9IGludmVydGVkO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBkZWNvcmF0b3IgPyAnRGVjb3JhdG9yQmxvY2snIDogJ0Jsb2NrU3RhdGVtZW50JyxcbiAgICBwYXRoOiBvcGVuQmxvY2sucGF0aCxcbiAgICBwYXJhbXM6IG9wZW5CbG9jay5wYXJhbXMsXG4gICAgaGFzaDogb3BlbkJsb2NrLmhhc2gsXG4gICAgcHJvZ3JhbSxcbiAgICBpbnZlcnNlLFxuICAgIG9wZW5TdHJpcDogb3BlbkJsb2NrLnN0cmlwLFxuICAgIGludmVyc2VTdHJpcCxcbiAgICBjbG9zZVN0cmlwOiBjbG9zZSAmJiBjbG9zZS5zdHJpcCxcbiAgICBsb2M6IHRoaXMubG9jSW5mbyhsb2NJbmZvKVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZVByb2dyYW0oc3RhdGVtZW50cywgbG9jKSB7XG4gIGlmICghbG9jICYmIHN0YXRlbWVudHMubGVuZ3RoKSB7XG4gICAgY29uc3QgZmlyc3RMb2MgPSBzdGF0ZW1lbnRzWzBdLmxvYyxcbiAgICAgICAgICBsYXN0TG9jID0gc3RhdGVtZW50c1tzdGF0ZW1lbnRzLmxlbmd0aCAtIDFdLmxvYztcblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKGZpcnN0TG9jICYmIGxhc3RMb2MpIHtcbiAgICAgIGxvYyA9IHtcbiAgICAgICAgc291cmNlOiBmaXJzdExvYy5zb3VyY2UsXG4gICAgICAgIHN0YXJ0OiB7XG4gICAgICAgICAgbGluZTogZmlyc3RMb2Muc3RhcnQubGluZSxcbiAgICAgICAgICBjb2x1bW46IGZpcnN0TG9jLnN0YXJ0LmNvbHVtblxuICAgICAgICB9LFxuICAgICAgICBlbmQ6IHtcbiAgICAgICAgICBsaW5lOiBsYXN0TG9jLmVuZC5saW5lLFxuICAgICAgICAgIGNvbHVtbjogbGFzdExvYy5lbmQuY29sdW1uXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnUHJvZ3JhbScsXG4gICAgYm9keTogc3RhdGVtZW50cyxcbiAgICBzdHJpcDoge30sXG4gICAgbG9jOiBsb2NcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZVBhcnRpYWxCbG9jayhvcGVuLCBwcm9ncmFtLCBjbG9zZSwgbG9jSW5mbykge1xuICB2YWxpZGF0ZUNsb3NlKG9wZW4sIGNsb3NlKTtcblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdQYXJ0aWFsQmxvY2tTdGF0ZW1lbnQnLFxuICAgIG5hbWU6IG9wZW4ucGF0aCxcbiAgICBwYXJhbXM6IG9wZW4ucGFyYW1zLFxuICAgIGhhc2g6IG9wZW4uaGFzaCxcbiAgICBwcm9ncmFtLFxuICAgIG9wZW5TdHJpcDogb3Blbi5zdHJpcCxcbiAgICBjbG9zZVN0cmlwOiBjbG9zZSAmJiBjbG9zZS5zdHJpcCxcbiAgICBsb2M6IHRoaXMubG9jSW5mbyhsb2NJbmZvKVxuICB9O1xufVxuXG4iLCJpbXBvcnQgeyBDT01QSUxFUl9SRVZJU0lPTiwgUkVWSVNJT05fQ0hBTkdFUyB9IGZyb20gJy4uL2Jhc2UnO1xuaW1wb3J0IEV4Y2VwdGlvbiBmcm9tICcuLi9leGNlcHRpb24nO1xuaW1wb3J0IHtpc0FycmF5fSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgQ29kZUdlbiBmcm9tICcuL2NvZGUtZ2VuJztcblxuZnVuY3Rpb24gTGl0ZXJhbCh2YWx1ZSkge1xuICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIEphdmFTY3JpcHRDb21waWxlcigpIHt9XG5cbkphdmFTY3JpcHRDb21waWxlci5wcm90b3R5cGUgPSB7XG4gIC8vIFBVQkxJQyBBUEk6IFlvdSBjYW4gb3ZlcnJpZGUgdGhlc2UgbWV0aG9kcyBpbiBhIHN1YmNsYXNzIHRvIHByb3ZpZGVcbiAgLy8gYWx0ZXJuYXRpdmUgY29tcGlsZWQgZm9ybXMgZm9yIG5hbWUgbG9va3VwIGFuZCBidWZmZXJpbmcgc2VtYW50aWNzXG4gIG5hbWVMb29rdXA6IGZ1bmN0aW9uKHBhcmVudCwgbmFtZS8qICwgdHlwZSovKSB7XG4gICAgaWYgKEphdmFTY3JpcHRDb21waWxlci5pc1ZhbGlkSmF2YVNjcmlwdFZhcmlhYmxlTmFtZShuYW1lKSkge1xuICAgICAgcmV0dXJuIFtwYXJlbnQsICcuJywgbmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBbcGFyZW50LCAnWycsIEpTT04uc3RyaW5naWZ5KG5hbWUpLCAnXSddO1xuICAgIH1cbiAgfSxcbiAgZGVwdGhlZExvb2t1cDogZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiBbdGhpcy5hbGlhc2FibGUoJ2NvbnRhaW5lci5sb29rdXAnKSwgJyhkZXB0aHMsIFwiJywgbmFtZSwgJ1wiKSddO1xuICB9LFxuXG4gIGNvbXBpbGVySW5mbzogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgcmV2aXNpb24gPSBDT01QSUxFUl9SRVZJU0lPTixcbiAgICAgICAgICB2ZXJzaW9ucyA9IFJFVklTSU9OX0NIQU5HRVNbcmV2aXNpb25dO1xuICAgIHJldHVybiBbcmV2aXNpb24sIHZlcnNpb25zXTtcbiAgfSxcblxuICBhcHBlbmRUb0J1ZmZlcjogZnVuY3Rpb24oc291cmNlLCBsb2NhdGlvbiwgZXhwbGljaXQpIHtcbiAgICAvLyBGb3JjZSBhIHNvdXJjZSBhcyB0aGlzIHNpbXBsaWZpZXMgdGhlIG1lcmdlIGxvZ2ljLlxuICAgIGlmICghaXNBcnJheShzb3VyY2UpKSB7XG4gICAgICBzb3VyY2UgPSBbc291cmNlXTtcbiAgICB9XG4gICAgc291cmNlID0gdGhpcy5zb3VyY2Uud3JhcChzb3VyY2UsIGxvY2F0aW9uKTtcblxuICAgIGlmICh0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICByZXR1cm4gWydyZXR1cm4gJywgc291cmNlLCAnOyddO1xuICAgIH0gZWxzZSBpZiAoZXhwbGljaXQpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSBjYXNlIHdoZXJlIHRoZSBidWZmZXIgb3BlcmF0aW9uIG9jY3VycyBhcyBhIGNoaWxkIG9mIGFub3RoZXJcbiAgICAgIC8vIGNvbnN0cnVjdCwgZ2VuZXJhbGx5IGJyYWNlcy4gV2UgaGF2ZSB0byBleHBsaWNpdGx5IG91dHB1dCB0aGVzZSBidWZmZXJcbiAgICAgIC8vIG9wZXJhdGlvbnMgdG8gZW5zdXJlIHRoYXQgdGhlIGVtaXR0ZWQgY29kZSBnb2VzIGluIHRoZSBjb3JyZWN0IGxvY2F0aW9uLlxuICAgICAgcmV0dXJuIFsnYnVmZmVyICs9ICcsIHNvdXJjZSwgJzsnXTtcbiAgICB9IGVsc2Uge1xuICAgICAgc291cmNlLmFwcGVuZFRvQnVmZmVyID0gdHJ1ZTtcbiAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgfVxuICB9LFxuXG4gIGluaXRpYWxpemVCdWZmZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnF1b3RlZFN0cmluZygnJyk7XG4gIH0sXG4gIC8vIEVORCBQVUJMSUMgQVBJXG5cbiAgY29tcGlsZTogZnVuY3Rpb24oZW52aXJvbm1lbnQsIG9wdGlvbnMsIGNvbnRleHQsIGFzT2JqZWN0KSB7XG4gICAgdGhpcy5lbnZpcm9ubWVudCA9IGVudmlyb25tZW50O1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5zdHJpbmdQYXJhbXMgPSB0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zO1xuICAgIHRoaXMudHJhY2tJZHMgPSB0aGlzLm9wdGlvbnMudHJhY2tJZHM7XG4gICAgdGhpcy5wcmVjb21waWxlID0gIWFzT2JqZWN0O1xuXG4gICAgdGhpcy5uYW1lID0gdGhpcy5lbnZpcm9ubWVudC5uYW1lO1xuICAgIHRoaXMuaXNDaGlsZCA9ICEhY29udGV4dDtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0IHx8IHtcbiAgICAgIGRlY29yYXRvcnM6IFtdLFxuICAgICAgcHJvZ3JhbXM6IFtdLFxuICAgICAgZW52aXJvbm1lbnRzOiBbXVxuICAgIH07XG5cbiAgICB0aGlzLnByZWFtYmxlKCk7XG5cbiAgICB0aGlzLnN0YWNrU2xvdCA9IDA7XG4gICAgdGhpcy5zdGFja1ZhcnMgPSBbXTtcbiAgICB0aGlzLmFsaWFzZXMgPSB7fTtcbiAgICB0aGlzLnJlZ2lzdGVycyA9IHsgbGlzdDogW10gfTtcbiAgICB0aGlzLmhhc2hlcyA9IFtdO1xuICAgIHRoaXMuY29tcGlsZVN0YWNrID0gW107XG4gICAgdGhpcy5pbmxpbmVTdGFjayA9IFtdO1xuICAgIHRoaXMuYmxvY2tQYXJhbXMgPSBbXTtcblxuICAgIHRoaXMuY29tcGlsZUNoaWxkcmVuKGVudmlyb25tZW50LCBvcHRpb25zKTtcblxuICAgIHRoaXMudXNlRGVwdGhzID0gdGhpcy51c2VEZXB0aHMgfHwgZW52aXJvbm1lbnQudXNlRGVwdGhzIHx8IGVudmlyb25tZW50LnVzZURlY29yYXRvcnMgfHwgdGhpcy5vcHRpb25zLmNvbXBhdDtcbiAgICB0aGlzLnVzZUJsb2NrUGFyYW1zID0gdGhpcy51c2VCbG9ja1BhcmFtcyB8fCBlbnZpcm9ubWVudC51c2VCbG9ja1BhcmFtcztcblxuICAgIGxldCBvcGNvZGVzID0gZW52aXJvbm1lbnQub3Bjb2RlcyxcbiAgICAgICAgb3Bjb2RlLFxuICAgICAgICBmaXJzdExvYyxcbiAgICAgICAgaSxcbiAgICAgICAgbDtcblxuICAgIGZvciAoaSA9IDAsIGwgPSBvcGNvZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgb3Bjb2RlID0gb3Bjb2Rlc1tpXTtcblxuICAgICAgdGhpcy5zb3VyY2UuY3VycmVudExvY2F0aW9uID0gb3Bjb2RlLmxvYztcbiAgICAgIGZpcnN0TG9jID0gZmlyc3RMb2MgfHwgb3Bjb2RlLmxvYztcbiAgICAgIHRoaXNbb3Bjb2RlLm9wY29kZV0uYXBwbHkodGhpcywgb3Bjb2RlLmFyZ3MpO1xuICAgIH1cblxuICAgIC8vIEZsdXNoIGFueSB0cmFpbGluZyBjb250ZW50IHRoYXQgbWlnaHQgYmUgcGVuZGluZy5cbiAgICB0aGlzLnNvdXJjZS5jdXJyZW50TG9jYXRpb24gPSBmaXJzdExvYztcbiAgICB0aGlzLnB1c2hTb3VyY2UoJycpO1xuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodGhpcy5zdGFja1Nsb3QgfHwgdGhpcy5pbmxpbmVTdGFjay5sZW5ndGggfHwgdGhpcy5jb21waWxlU3RhY2subGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdDb21waWxlIGNvbXBsZXRlZCB3aXRoIGNvbnRlbnQgbGVmdCBvbiBzdGFjaycpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5kZWNvcmF0b3JzLmlzRW1wdHkoKSkge1xuICAgICAgdGhpcy51c2VEZWNvcmF0b3JzID0gdHJ1ZTtcblxuICAgICAgdGhpcy5kZWNvcmF0b3JzLnByZXBlbmQoJ3ZhciBkZWNvcmF0b3JzID0gY29udGFpbmVyLmRlY29yYXRvcnM7XFxuJyk7XG4gICAgICB0aGlzLmRlY29yYXRvcnMucHVzaCgncmV0dXJuIGZuOycpO1xuXG4gICAgICBpZiAoYXNPYmplY3QpIHtcbiAgICAgICAgdGhpcy5kZWNvcmF0b3JzID0gRnVuY3Rpb24uYXBwbHkodGhpcywgWydmbicsICdwcm9wcycsICdjb250YWluZXInLCAnZGVwdGgwJywgJ2RhdGEnLCAnYmxvY2tQYXJhbXMnLCAnZGVwdGhzJywgdGhpcy5kZWNvcmF0b3JzLm1lcmdlKCldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVjb3JhdG9ycy5wcmVwZW5kKCdmdW5jdGlvbihmbiwgcHJvcHMsIGNvbnRhaW5lciwgZGVwdGgwLCBkYXRhLCBibG9ja1BhcmFtcywgZGVwdGhzKSB7XFxuJyk7XG4gICAgICAgIHRoaXMuZGVjb3JhdG9ycy5wdXNoKCd9XFxuJyk7XG4gICAgICAgIHRoaXMuZGVjb3JhdG9ycyA9IHRoaXMuZGVjb3JhdG9ycy5tZXJnZSgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlY29yYXRvcnMgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgbGV0IGZuID0gdGhpcy5jcmVhdGVGdW5jdGlvbkNvbnRleHQoYXNPYmplY3QpO1xuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICBsZXQgcmV0ID0ge1xuICAgICAgICBjb21waWxlcjogdGhpcy5jb21waWxlckluZm8oKSxcbiAgICAgICAgbWFpbjogZm5cbiAgICAgIH07XG5cbiAgICAgIGlmICh0aGlzLmRlY29yYXRvcnMpIHtcbiAgICAgICAgcmV0Lm1haW5fZCA9IHRoaXMuZGVjb3JhdG9yczsgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGNhbWVsY2FzZVxuICAgICAgICByZXQudXNlRGVjb3JhdG9ycyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGxldCB7cHJvZ3JhbXMsIGRlY29yYXRvcnN9ID0gdGhpcy5jb250ZXh0O1xuICAgICAgZm9yIChpID0gMCwgbCA9IHByb2dyYW1zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZiAocHJvZ3JhbXNbaV0pIHtcbiAgICAgICAgICByZXRbaV0gPSBwcm9ncmFtc1tpXTtcbiAgICAgICAgICBpZiAoZGVjb3JhdG9yc1tpXSkge1xuICAgICAgICAgICAgcmV0W2kgKyAnX2QnXSA9IGRlY29yYXRvcnNbaV07XG4gICAgICAgICAgICByZXQudXNlRGVjb3JhdG9ycyA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmVudmlyb25tZW50LnVzZVBhcnRpYWwpIHtcbiAgICAgICAgcmV0LnVzZVBhcnRpYWwgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5kYXRhKSB7XG4gICAgICAgIHJldC51c2VEYXRhID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnVzZURlcHRocykge1xuICAgICAgICByZXQudXNlRGVwdGhzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnVzZUJsb2NrUGFyYW1zKSB7XG4gICAgICAgIHJldC51c2VCbG9ja1BhcmFtcyA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmNvbXBhdCkge1xuICAgICAgICByZXQuY29tcGF0ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFhc09iamVjdCkge1xuICAgICAgICByZXQuY29tcGlsZXIgPSBKU09OLnN0cmluZ2lmeShyZXQuY29tcGlsZXIpO1xuXG4gICAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRMb2NhdGlvbiA9IHtzdGFydDoge2xpbmU6IDEsIGNvbHVtbjogMH19O1xuICAgICAgICByZXQgPSB0aGlzLm9iamVjdExpdGVyYWwocmV0KTtcblxuICAgICAgICBpZiAob3B0aW9ucy5zcmNOYW1lKSB7XG4gICAgICAgICAgcmV0ID0gcmV0LnRvU3RyaW5nV2l0aFNvdXJjZU1hcCh7ZmlsZTogb3B0aW9ucy5kZXN0TmFtZX0pO1xuICAgICAgICAgIHJldC5tYXAgPSByZXQubWFwICYmIHJldC5tYXAudG9TdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXQgPSByZXQudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0LmNvbXBpbGVyT3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZuO1xuICAgIH1cbiAgfSxcblxuICBwcmVhbWJsZTogZnVuY3Rpb24oKSB7XG4gICAgLy8gdHJhY2sgdGhlIGxhc3QgY29udGV4dCBwdXNoZWQgaW50byBwbGFjZSB0byBhbGxvdyBza2lwcGluZyB0aGVcbiAgICAvLyBnZXRDb250ZXh0IG9wY29kZSB3aGVuIGl0IHdvdWxkIGJlIGEgbm9vcFxuICAgIHRoaXMubGFzdENvbnRleHQgPSAwO1xuICAgIHRoaXMuc291cmNlID0gbmV3IENvZGVHZW4odGhpcy5vcHRpb25zLnNyY05hbWUpO1xuICAgIHRoaXMuZGVjb3JhdG9ycyA9IG5ldyBDb2RlR2VuKHRoaXMub3B0aW9ucy5zcmNOYW1lKTtcbiAgfSxcblxuICBjcmVhdGVGdW5jdGlvbkNvbnRleHQ6IGZ1bmN0aW9uKGFzT2JqZWN0KSB7XG4gICAgbGV0IHZhckRlY2xhcmF0aW9ucyA9ICcnO1xuXG4gICAgbGV0IGxvY2FscyA9IHRoaXMuc3RhY2tWYXJzLmNvbmNhdCh0aGlzLnJlZ2lzdGVycy5saXN0KTtcbiAgICBpZiAobG9jYWxzLmxlbmd0aCA+IDApIHtcbiAgICAgIHZhckRlY2xhcmF0aW9ucyArPSAnLCAnICsgbG9jYWxzLmpvaW4oJywgJyk7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgbWluaW1pemVyIGFsaWFzIG1hcHBpbmdzXG4gICAgLy9cbiAgICAvLyBXaGVuIHVzaW5nIHRydWUgU291cmNlTm9kZXMsIHRoaXMgd2lsbCB1cGRhdGUgYWxsIHJlZmVyZW5jZXMgdG8gdGhlIGdpdmVuIGFsaWFzXG4gICAgLy8gYXMgdGhlIHNvdXJjZSBub2RlcyBhcmUgcmV1c2VkIGluIHNpdHUuIEZvciB0aGUgbm9uLXNvdXJjZSBub2RlIGNvbXBpbGF0aW9uIG1vZGUsXG4gICAgLy8gYWxpYXNlcyB3aWxsIG5vdCBiZSB1c2VkLCBidXQgdGhpcyBjYXNlIGlzIGFscmVhZHkgYmVpbmcgcnVuIG9uIHRoZSBjbGllbnQgYW5kXG4gICAgLy8gd2UgYXJlbid0IGNvbmNlcm4gYWJvdXQgbWluaW1pemluZyB0aGUgdGVtcGxhdGUgc2l6ZS5cbiAgICBsZXQgYWxpYXNDb3VudCA9IDA7XG4gICAgZm9yIChsZXQgYWxpYXMgaW4gdGhpcy5hbGlhc2VzKSB7ICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZ3VhcmQtZm9yLWluXG4gICAgICBsZXQgbm9kZSA9IHRoaXMuYWxpYXNlc1thbGlhc107XG5cbiAgICAgIGlmICh0aGlzLmFsaWFzZXMuaGFzT3duUHJvcGVydHkoYWxpYXMpICYmIG5vZGUuY2hpbGRyZW4gJiYgbm9kZS5yZWZlcmVuY2VDb3VudCA+IDEpIHtcbiAgICAgICAgdmFyRGVjbGFyYXRpb25zICs9ICcsIGFsaWFzJyArICgrK2FsaWFzQ291bnQpICsgJz0nICsgYWxpYXM7XG4gICAgICAgIG5vZGUuY2hpbGRyZW5bMF0gPSAnYWxpYXMnICsgYWxpYXNDb3VudDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgcGFyYW1zID0gWydjb250YWluZXInLCAnZGVwdGgwJywgJ2hlbHBlcnMnLCAncGFydGlhbHMnLCAnZGF0YSddO1xuXG4gICAgaWYgKHRoaXMudXNlQmxvY2tQYXJhbXMgfHwgdGhpcy51c2VEZXB0aHMpIHtcbiAgICAgIHBhcmFtcy5wdXNoKCdibG9ja1BhcmFtcycpO1xuICAgIH1cbiAgICBpZiAodGhpcy51c2VEZXB0aHMpIHtcbiAgICAgIHBhcmFtcy5wdXNoKCdkZXB0aHMnKTtcbiAgICB9XG5cbiAgICAvLyBQZXJmb3JtIGEgc2Vjb25kIHBhc3Mgb3ZlciB0aGUgb3V0cHV0IHRvIG1lcmdlIGNvbnRlbnQgd2hlbiBwb3NzaWJsZVxuICAgIGxldCBzb3VyY2UgPSB0aGlzLm1lcmdlU291cmNlKHZhckRlY2xhcmF0aW9ucyk7XG5cbiAgICBpZiAoYXNPYmplY3QpIHtcbiAgICAgIHBhcmFtcy5wdXNoKHNvdXJjZSk7XG5cbiAgICAgIHJldHVybiBGdW5jdGlvbi5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5zb3VyY2Uud3JhcChbJ2Z1bmN0aW9uKCcsIHBhcmFtcy5qb2luKCcsJyksICcpIHtcXG4gICcsIHNvdXJjZSwgJ30nXSk7XG4gICAgfVxuICB9LFxuICBtZXJnZVNvdXJjZTogZnVuY3Rpb24odmFyRGVjbGFyYXRpb25zKSB7XG4gICAgbGV0IGlzU2ltcGxlID0gdGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSxcbiAgICAgICAgYXBwZW5kT25seSA9ICF0aGlzLmZvcmNlQnVmZmVyLFxuICAgICAgICBhcHBlbmRGaXJzdCxcblxuICAgICAgICBzb3VyY2VTZWVuLFxuICAgICAgICBidWZmZXJTdGFydCxcbiAgICAgICAgYnVmZmVyRW5kO1xuICAgIHRoaXMuc291cmNlLmVhY2goKGxpbmUpID0+IHtcbiAgICAgIGlmIChsaW5lLmFwcGVuZFRvQnVmZmVyKSB7XG4gICAgICAgIGlmIChidWZmZXJTdGFydCkge1xuICAgICAgICAgIGxpbmUucHJlcGVuZCgnICArICcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJ1ZmZlclN0YXJ0ID0gbGluZTtcbiAgICAgICAgfVxuICAgICAgICBidWZmZXJFbmQgPSBsaW5lO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGJ1ZmZlclN0YXJ0KSB7XG4gICAgICAgICAgaWYgKCFzb3VyY2VTZWVuKSB7XG4gICAgICAgICAgICBhcHBlbmRGaXJzdCA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ1ZmZlclN0YXJ0LnByZXBlbmQoJ2J1ZmZlciArPSAnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnVmZmVyRW5kLmFkZCgnOycpO1xuICAgICAgICAgIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgc291cmNlU2VlbiA9IHRydWU7XG4gICAgICAgIGlmICghaXNTaW1wbGUpIHtcbiAgICAgICAgICBhcHBlbmRPbmx5ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgaWYgKGFwcGVuZE9ubHkpIHtcbiAgICAgIGlmIChidWZmZXJTdGFydCkge1xuICAgICAgICBidWZmZXJTdGFydC5wcmVwZW5kKCdyZXR1cm4gJyk7XG4gICAgICAgIGJ1ZmZlckVuZC5hZGQoJzsnKTtcbiAgICAgIH0gZWxzZSBpZiAoIXNvdXJjZVNlZW4pIHtcbiAgICAgICAgdGhpcy5zb3VyY2UucHVzaCgncmV0dXJuIFwiXCI7Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhckRlY2xhcmF0aW9ucyArPSAnLCBidWZmZXIgPSAnICsgKGFwcGVuZEZpcnN0ID8gJycgOiB0aGlzLmluaXRpYWxpemVCdWZmZXIoKSk7XG5cbiAgICAgIGlmIChidWZmZXJTdGFydCkge1xuICAgICAgICBidWZmZXJTdGFydC5wcmVwZW5kKCdyZXR1cm4gYnVmZmVyICsgJyk7XG4gICAgICAgIGJ1ZmZlckVuZC5hZGQoJzsnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc291cmNlLnB1c2goJ3JldHVybiBidWZmZXI7Jyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHZhckRlY2xhcmF0aW9ucykge1xuICAgICAgdGhpcy5zb3VyY2UucHJlcGVuZCgndmFyICcgKyB2YXJEZWNsYXJhdGlvbnMuc3Vic3RyaW5nKDIpICsgKGFwcGVuZEZpcnN0ID8gJycgOiAnO1xcbicpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zb3VyY2UubWVyZ2UoKTtcbiAgfSxcblxuICAvLyBbYmxvY2tWYWx1ZV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgdmFsdWVcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXR1cm4gdmFsdWUgb2YgYmxvY2tIZWxwZXJNaXNzaW5nXG4gIC8vXG4gIC8vIFRoZSBwdXJwb3NlIG9mIHRoaXMgb3Bjb2RlIGlzIHRvIHRha2UgYSBibG9jayBvZiB0aGUgZm9ybVxuICAvLyBge3sjdGhpcy5mb299fS4uLnt7L3RoaXMuZm9vfX1gLCByZXNvbHZlIHRoZSB2YWx1ZSBvZiBgZm9vYCwgYW5kXG4gIC8vIHJlcGxhY2UgaXQgb24gdGhlIHN0YWNrIHdpdGggdGhlIHJlc3VsdCBvZiBwcm9wZXJseVxuICAvLyBpbnZva2luZyBibG9ja0hlbHBlck1pc3NpbmcuXG4gIGJsb2NrVmFsdWU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBsZXQgYmxvY2tIZWxwZXJNaXNzaW5nID0gdGhpcy5hbGlhc2FibGUoJ2hlbHBlcnMuYmxvY2tIZWxwZXJNaXNzaW5nJyksXG4gICAgICAgIHBhcmFtcyA9IFt0aGlzLmNvbnRleHROYW1lKDApXTtcbiAgICB0aGlzLnNldHVwSGVscGVyQXJncyhuYW1lLCAwLCBwYXJhbXMpO1xuXG4gICAgbGV0IGJsb2NrTmFtZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICBwYXJhbXMuc3BsaWNlKDEsIDAsIGJsb2NrTmFtZSk7XG5cbiAgICB0aGlzLnB1c2godGhpcy5zb3VyY2UuZnVuY3Rpb25DYWxsKGJsb2NrSGVscGVyTWlzc2luZywgJ2NhbGwnLCBwYXJhbXMpKTtcbiAgfSxcblxuICAvLyBbYW1iaWd1b3VzQmxvY2tWYWx1ZV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgdmFsdWVcbiAgLy8gQ29tcGlsZXIgdmFsdWUsIGJlZm9yZTogbGFzdEhlbHBlcj12YWx1ZSBvZiBsYXN0IGZvdW5kIGhlbHBlciwgaWYgYW55XG4gIC8vIE9uIHN0YWNrLCBhZnRlciwgaWYgbm8gbGFzdEhlbHBlcjogc2FtZSBhcyBbYmxvY2tWYWx1ZV1cbiAgLy8gT24gc3RhY2ssIGFmdGVyLCBpZiBsYXN0SGVscGVyOiB2YWx1ZVxuICBhbWJpZ3VvdXNCbG9ja1ZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAvLyBXZSdyZSBiZWluZyBhIGJpdCBjaGVla3kgYW5kIHJldXNpbmcgdGhlIG9wdGlvbnMgdmFsdWUgZnJvbSB0aGUgcHJpb3IgZXhlY1xuICAgIGxldCBibG9ja0hlbHBlck1pc3NpbmcgPSB0aGlzLmFsaWFzYWJsZSgnaGVscGVycy5ibG9ja0hlbHBlck1pc3NpbmcnKSxcbiAgICAgICAgcGFyYW1zID0gW3RoaXMuY29udGV4dE5hbWUoMCldO1xuICAgIHRoaXMuc2V0dXBIZWxwZXJBcmdzKCcnLCAwLCBwYXJhbXMsIHRydWUpO1xuXG4gICAgdGhpcy5mbHVzaElubGluZSgpO1xuXG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLnRvcFN0YWNrKCk7XG4gICAgcGFyYW1zLnNwbGljZSgxLCAwLCBjdXJyZW50KTtcblxuICAgIHRoaXMucHVzaFNvdXJjZShbXG4gICAgICAgICdpZiAoIScsIHRoaXMubGFzdEhlbHBlciwgJykgeyAnLFxuICAgICAgICAgIGN1cnJlbnQsICcgPSAnLCB0aGlzLnNvdXJjZS5mdW5jdGlvbkNhbGwoYmxvY2tIZWxwZXJNaXNzaW5nLCAnY2FsbCcsIHBhcmFtcyksXG4gICAgICAgICd9J10pO1xuICB9LFxuXG4gIC8vIFthcHBlbmRDb250ZW50XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gQXBwZW5kcyB0aGUgc3RyaW5nIHZhbHVlIG9mIGBjb250ZW50YCB0byB0aGUgY3VycmVudCBidWZmZXJcbiAgYXBwZW5kQ29udGVudDogZnVuY3Rpb24oY29udGVudCkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb250ZW50KSB7XG4gICAgICBjb250ZW50ID0gdGhpcy5wZW5kaW5nQ29udGVudCArIGNvbnRlbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGVuZGluZ0xvY2F0aW9uID0gdGhpcy5zb3VyY2UuY3VycmVudExvY2F0aW9uO1xuICAgIH1cblxuICAgIHRoaXMucGVuZGluZ0NvbnRlbnQgPSBjb250ZW50O1xuICB9LFxuXG4gIC8vIFthcHBlbmRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gQ29lcmNlcyBgdmFsdWVgIHRvIGEgU3RyaW5nIGFuZCBhcHBlbmRzIGl0IHRvIHRoZSBjdXJyZW50IGJ1ZmZlci5cbiAgLy9cbiAgLy8gSWYgYHZhbHVlYCBpcyB0cnV0aHksIG9yIDAsIGl0IGlzIGNvZXJjZWQgaW50byBhIHN0cmluZyBhbmQgYXBwZW5kZWRcbiAgLy8gT3RoZXJ3aXNlLCB0aGUgZW1wdHkgc3RyaW5nIGlzIGFwcGVuZGVkXG4gIGFwcGVuZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaXNJbmxpbmUoKSkge1xuICAgICAgdGhpcy5yZXBsYWNlU3RhY2soKGN1cnJlbnQpID0+IFsnICE9IG51bGwgPyAnLCBjdXJyZW50LCAnIDogXCJcIiddKTtcblxuICAgICAgdGhpcy5wdXNoU291cmNlKHRoaXMuYXBwZW5kVG9CdWZmZXIodGhpcy5wb3BTdGFjaygpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBsb2NhbCA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIHRoaXMucHVzaFNvdXJjZShbJ2lmICgnLCBsb2NhbCwgJyAhPSBudWxsKSB7ICcsIHRoaXMuYXBwZW5kVG9CdWZmZXIobG9jYWwsIHVuZGVmaW5lZCwgdHJ1ZSksICcgfSddKTtcbiAgICAgIGlmICh0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICAgIHRoaXMucHVzaFNvdXJjZShbJ2Vsc2UgeyAnLCB0aGlzLmFwcGVuZFRvQnVmZmVyKFwiJydcIiwgdW5kZWZpbmVkLCB0cnVlKSwgJyB9J10pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvLyBbYXBwZW5kRXNjYXBlZF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvL1xuICAvLyBFc2NhcGUgYHZhbHVlYCBhbmQgYXBwZW5kIGl0IHRvIHRoZSBidWZmZXJcbiAgYXBwZW5kRXNjYXBlZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wdXNoU291cmNlKHRoaXMuYXBwZW5kVG9CdWZmZXIoXG4gICAgICAgIFt0aGlzLmFsaWFzYWJsZSgnY29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb24nKSwgJygnLCB0aGlzLnBvcFN0YWNrKCksICcpJ10pKTtcbiAgfSxcblxuICAvLyBbZ2V0Q29udGV4dF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vIENvbXBpbGVyIHZhbHVlLCBhZnRlcjogbGFzdENvbnRleHQ9ZGVwdGhcbiAgLy9cbiAgLy8gU2V0IHRoZSB2YWx1ZSBvZiB0aGUgYGxhc3RDb250ZXh0YCBjb21waWxlciB2YWx1ZSB0byB0aGUgZGVwdGhcbiAgZ2V0Q29udGV4dDogZnVuY3Rpb24oZGVwdGgpIHtcbiAgICB0aGlzLmxhc3RDb250ZXh0ID0gZGVwdGg7XG4gIH0sXG5cbiAgLy8gW3B1c2hDb250ZXh0XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBjdXJyZW50Q29udGV4dCwgLi4uXG4gIC8vXG4gIC8vIFB1c2hlcyB0aGUgdmFsdWUgb2YgdGhlIGN1cnJlbnQgY29udGV4dCBvbnRvIHRoZSBzdGFjay5cbiAgcHVzaENvbnRleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh0aGlzLmNvbnRleHROYW1lKHRoaXMubGFzdENvbnRleHQpKTtcbiAgfSxcblxuICAvLyBbbG9va3VwT25Db250ZXh0XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBjdXJyZW50Q29udGV4dFtuYW1lXSwgLi4uXG4gIC8vXG4gIC8vIExvb2tzIHVwIHRoZSB2YWx1ZSBvZiBgbmFtZWAgb24gdGhlIGN1cnJlbnQgY29udGV4dCBhbmQgcHVzaGVzXG4gIC8vIGl0IG9udG8gdGhlIHN0YWNrLlxuICBsb29rdXBPbkNvbnRleHQ6IGZ1bmN0aW9uKHBhcnRzLCBmYWxzeSwgc3RyaWN0LCBzY29wZWQpIHtcbiAgICBsZXQgaSA9IDA7XG5cbiAgICBpZiAoIXNjb3BlZCAmJiB0aGlzLm9wdGlvbnMuY29tcGF0ICYmICF0aGlzLmxhc3RDb250ZXh0KSB7XG4gICAgICAvLyBUaGUgZGVwdGhlZCBxdWVyeSBpcyBleHBlY3RlZCB0byBoYW5kbGUgdGhlIHVuZGVmaW5lZCBsb2dpYyBmb3IgdGhlIHJvb3QgbGV2ZWwgdGhhdFxuICAgICAgLy8gaXMgaW1wbGVtZW50ZWQgYmVsb3csIHNvIHdlIGV2YWx1YXRlIHRoYXQgZGlyZWN0bHkgaW4gY29tcGF0IG1vZGVcbiAgICAgIHRoaXMucHVzaCh0aGlzLmRlcHRoZWRMb29rdXAocGFydHNbaSsrXSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5yZXNvbHZlUGF0aCgnY29udGV4dCcsIHBhcnRzLCBpLCBmYWxzeSwgc3RyaWN0KTtcbiAgfSxcblxuICAvLyBbbG9va3VwQmxvY2tQYXJhbV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogYmxvY2tQYXJhbVtuYW1lXSwgLi4uXG4gIC8vXG4gIC8vIExvb2tzIHVwIHRoZSB2YWx1ZSBvZiBgcGFydHNgIG9uIHRoZSBnaXZlbiBibG9jayBwYXJhbSBhbmQgcHVzaGVzXG4gIC8vIGl0IG9udG8gdGhlIHN0YWNrLlxuICBsb29rdXBCbG9ja1BhcmFtOiBmdW5jdGlvbihibG9ja1BhcmFtSWQsIHBhcnRzKSB7XG4gICAgdGhpcy51c2VCbG9ja1BhcmFtcyA9IHRydWU7XG5cbiAgICB0aGlzLnB1c2goWydibG9ja1BhcmFtc1snLCBibG9ja1BhcmFtSWRbMF0sICddWycsIGJsb2NrUGFyYW1JZFsxXSwgJ10nXSk7XG4gICAgdGhpcy5yZXNvbHZlUGF0aCgnY29udGV4dCcsIHBhcnRzLCAxKTtcbiAgfSxcblxuICAvLyBbbG9va3VwRGF0YV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogZGF0YSwgLi4uXG4gIC8vXG4gIC8vIFB1c2ggdGhlIGRhdGEgbG9va3VwIG9wZXJhdG9yXG4gIGxvb2t1cERhdGE6IGZ1bmN0aW9uKGRlcHRoLCBwYXJ0cywgc3RyaWN0KSB7XG4gICAgaWYgKCFkZXB0aCkge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCdkYXRhJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgnY29udGFpbmVyLmRhdGEoZGF0YSwgJyArIGRlcHRoICsgJyknKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlc29sdmVQYXRoKCdkYXRhJywgcGFydHMsIDAsIHRydWUsIHN0cmljdCk7XG4gIH0sXG5cbiAgcmVzb2x2ZVBhdGg6IGZ1bmN0aW9uKHR5cGUsIHBhcnRzLCBpLCBmYWxzeSwgc3RyaWN0KSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpY3QgfHwgdGhpcy5vcHRpb25zLmFzc3VtZU9iamVjdHMpIHtcbiAgICAgIHRoaXMucHVzaChzdHJpY3RMb29rdXAodGhpcy5vcHRpb25zLnN0cmljdCAmJiBzdHJpY3QsIHRoaXMsIHBhcnRzLCB0eXBlKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IGxlbiA9IHBhcnRzLmxlbmd0aDtcbiAgICBmb3IgKDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1sb29wLWZ1bmMgKi9cbiAgICAgIHRoaXMucmVwbGFjZVN0YWNrKChjdXJyZW50KSA9PiB7XG4gICAgICAgIGxldCBsb29rdXAgPSB0aGlzLm5hbWVMb29rdXAoY3VycmVudCwgcGFydHNbaV0sIHR5cGUpO1xuICAgICAgICAvLyBXZSB3YW50IHRvIGVuc3VyZSB0aGF0IHplcm8gYW5kIGZhbHNlIGFyZSBoYW5kbGVkIHByb3Blcmx5IGlmIHRoZSBjb250ZXh0IChmYWxzeSBmbGFnKVxuICAgICAgICAvLyBuZWVkcyB0byBoYXZlIHRoZSBzcGVjaWFsIGhhbmRsaW5nIGZvciB0aGVzZSB2YWx1ZXMuXG4gICAgICAgIGlmICghZmFsc3kpIHtcbiAgICAgICAgICByZXR1cm4gWycgIT0gbnVsbCA/ICcsIGxvb2t1cCwgJyA6ICcsIGN1cnJlbnRdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSB3ZSBjYW4gdXNlIGdlbmVyaWMgZmFsc3kgaGFuZGxpbmdcbiAgICAgICAgICByZXR1cm4gWycgJiYgJywgbG9va3VwXTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWxvb3AtZnVuYyAqL1xuICAgIH1cbiAgfSxcblxuICAvLyBbcmVzb2x2ZVBvc3NpYmxlTGFtYmRhXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzb2x2ZWQgdmFsdWUsIC4uLlxuICAvL1xuICAvLyBJZiB0aGUgYHZhbHVlYCBpcyBhIGxhbWJkYSwgcmVwbGFjZSBpdCBvbiB0aGUgc3RhY2sgYnlcbiAgLy8gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgbGFtYmRhXG4gIHJlc29sdmVQb3NzaWJsZUxhbWJkYTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wdXNoKFt0aGlzLmFsaWFzYWJsZSgnY29udGFpbmVyLmxhbWJkYScpLCAnKCcsIHRoaXMucG9wU3RhY2soKSwgJywgJywgdGhpcy5jb250ZXh0TmFtZSgwKSwgJyknXSk7XG4gIH0sXG5cbiAgLy8gW3B1c2hTdHJpbmdQYXJhbV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogc3RyaW5nLCBjdXJyZW50Q29udGV4dCwgLi4uXG4gIC8vXG4gIC8vIFRoaXMgb3Bjb2RlIGlzIGRlc2lnbmVkIGZvciB1c2UgaW4gc3RyaW5nIG1vZGUsIHdoaWNoXG4gIC8vIHByb3ZpZGVzIHRoZSBzdHJpbmcgdmFsdWUgb2YgYSBwYXJhbWV0ZXIgYWxvbmcgd2l0aCBpdHNcbiAgLy8gZGVwdGggcmF0aGVyIHRoYW4gcmVzb2x2aW5nIGl0IGltbWVkaWF0ZWx5LlxuICBwdXNoU3RyaW5nUGFyYW06IGZ1bmN0aW9uKHN0cmluZywgdHlwZSkge1xuICAgIHRoaXMucHVzaENvbnRleHQoKTtcbiAgICB0aGlzLnB1c2hTdHJpbmcodHlwZSk7XG5cbiAgICAvLyBJZiBpdCdzIGEgc3ViZXhwcmVzc2lvbiwgdGhlIHN0cmluZyByZXN1bHRcbiAgICAvLyB3aWxsIGJlIHB1c2hlZCBhZnRlciB0aGlzIG9wY29kZS5cbiAgICBpZiAodHlwZSAhPT0gJ1N1YkV4cHJlc3Npb24nKSB7XG4gICAgICBpZiAodHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5wdXNoU3RyaW5nKHN0cmluZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgZW1wdHlIYXNoOiBmdW5jdGlvbihvbWl0RW1wdHkpIHtcbiAgICBpZiAodGhpcy50cmFja0lkcykge1xuICAgICAgdGhpcy5wdXNoKCd7fScpOyAvLyBoYXNoSWRzXG4gICAgfVxuICAgIGlmICh0aGlzLnN0cmluZ1BhcmFtcykge1xuICAgICAgdGhpcy5wdXNoKCd7fScpOyAvLyBoYXNoQ29udGV4dHNcbiAgICAgIHRoaXMucHVzaCgne30nKTsgLy8gaGFzaFR5cGVzXG4gICAgfVxuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbChvbWl0RW1wdHkgPyAndW5kZWZpbmVkJyA6ICd7fScpO1xuICB9LFxuICBwdXNoSGFzaDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaGFzaCkge1xuICAgICAgdGhpcy5oYXNoZXMucHVzaCh0aGlzLmhhc2gpO1xuICAgIH1cbiAgICB0aGlzLmhhc2ggPSB7dmFsdWVzOiBbXSwgdHlwZXM6IFtdLCBjb250ZXh0czogW10sIGlkczogW119O1xuICB9LFxuICBwb3BIYXNoOiBmdW5jdGlvbigpIHtcbiAgICBsZXQgaGFzaCA9IHRoaXMuaGFzaDtcbiAgICB0aGlzLmhhc2ggPSB0aGlzLmhhc2hlcy5wb3AoKTtcblxuICAgIGlmICh0aGlzLnRyYWNrSWRzKSB7XG4gICAgICB0aGlzLnB1c2godGhpcy5vYmplY3RMaXRlcmFsKGhhc2guaWRzKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0cmluZ1BhcmFtcykge1xuICAgICAgdGhpcy5wdXNoKHRoaXMub2JqZWN0TGl0ZXJhbChoYXNoLmNvbnRleHRzKSk7XG4gICAgICB0aGlzLnB1c2godGhpcy5vYmplY3RMaXRlcmFsKGhhc2gudHlwZXMpKTtcbiAgICB9XG5cbiAgICB0aGlzLnB1c2godGhpcy5vYmplY3RMaXRlcmFsKGhhc2gudmFsdWVzKSk7XG4gIH0sXG5cbiAgLy8gW3B1c2hTdHJpbmddXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHF1b3RlZFN0cmluZyhzdHJpbmcpLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCBhIHF1b3RlZCB2ZXJzaW9uIG9mIGBzdHJpbmdgIG9udG8gdGhlIHN0YWNrXG4gIHB1c2hTdHJpbmc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh0aGlzLnF1b3RlZFN0cmluZyhzdHJpbmcpKTtcbiAgfSxcblxuICAvLyBbcHVzaExpdGVyYWxdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHZhbHVlLCAuLi5cbiAgLy9cbiAgLy8gUHVzaGVzIGEgdmFsdWUgb250byB0aGUgc3RhY2suIFRoaXMgb3BlcmF0aW9uIHByZXZlbnRzXG4gIC8vIHRoZSBjb21waWxlciBmcm9tIGNyZWF0aW5nIGEgdGVtcG9yYXJ5IHZhcmlhYmxlIHRvIGhvbGRcbiAgLy8gaXQuXG4gIHB1c2hMaXRlcmFsOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh2YWx1ZSk7XG4gIH0sXG5cbiAgLy8gW3B1c2hQcm9ncmFtXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBwcm9ncmFtKGd1aWQpLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCBhIHByb2dyYW0gZXhwcmVzc2lvbiBvbnRvIHRoZSBzdGFjay4gVGhpcyB0YWtlc1xuICAvLyBhIGNvbXBpbGUtdGltZSBndWlkIGFuZCBjb252ZXJ0cyBpdCBpbnRvIGEgcnVudGltZS1hY2Nlc3NpYmxlXG4gIC8vIGV4cHJlc3Npb24uXG4gIHB1c2hQcm9ncmFtOiBmdW5jdGlvbihndWlkKSB7XG4gICAgaWYgKGd1aWQgIT0gbnVsbCkge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHRoaXMucHJvZ3JhbUV4cHJlc3Npb24oZ3VpZCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwobnVsbCk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFtyZWdpc3RlckRlY29yYXRvcl1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gUG9wcyBvZmYgdGhlIGRlY29yYXRvcidzIHBhcmFtZXRlcnMsIGludm9rZXMgdGhlIGRlY29yYXRvcixcbiAgLy8gYW5kIGluc2VydHMgdGhlIGRlY29yYXRvciBpbnRvIHRoZSBkZWNvcmF0b3JzIGxpc3QuXG4gIHJlZ2lzdGVyRGVjb3JhdG9yKHBhcmFtU2l6ZSwgbmFtZSkge1xuICAgIGxldCBmb3VuZERlY29yYXRvciA9IHRoaXMubmFtZUxvb2t1cCgnZGVjb3JhdG9ycycsIG5hbWUsICdkZWNvcmF0b3InKSxcbiAgICAgICAgb3B0aW9ucyA9IHRoaXMuc2V0dXBIZWxwZXJBcmdzKG5hbWUsIHBhcmFtU2l6ZSk7XG5cbiAgICB0aGlzLmRlY29yYXRvcnMucHVzaChbXG4gICAgICAnZm4gPSAnLFxuICAgICAgdGhpcy5kZWNvcmF0b3JzLmZ1bmN0aW9uQ2FsbChmb3VuZERlY29yYXRvciwgJycsIFsnZm4nLCAncHJvcHMnLCAnY29udGFpbmVyJywgb3B0aW9uc10pLFxuICAgICAgJyB8fCBmbjsnXG4gICAgXSk7XG4gIH0sXG5cbiAgLy8gW2ludm9rZUhlbHBlcl1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgaGVscGVyIGludm9jYXRpb25cbiAgLy9cbiAgLy8gUG9wcyBvZmYgdGhlIGhlbHBlcidzIHBhcmFtZXRlcnMsIGludm9rZXMgdGhlIGhlbHBlcixcbiAgLy8gYW5kIHB1c2hlcyB0aGUgaGVscGVyJ3MgcmV0dXJuIHZhbHVlIG9udG8gdGhlIHN0YWNrLlxuICAvL1xuICAvLyBJZiB0aGUgaGVscGVyIGlzIG5vdCBmb3VuZCwgYGhlbHBlck1pc3NpbmdgIGlzIGNhbGxlZC5cbiAgaW52b2tlSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUsIGlzU2ltcGxlKSB7XG4gICAgbGV0IG5vbkhlbHBlciA9IHRoaXMucG9wU3RhY2soKSxcbiAgICAgICAgaGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcihwYXJhbVNpemUsIG5hbWUpLFxuICAgICAgICBzaW1wbGUgPSBpc1NpbXBsZSA/IFtoZWxwZXIubmFtZSwgJyB8fCAnXSA6ICcnO1xuXG4gICAgbGV0IGxvb2t1cCA9IFsnKCddLmNvbmNhdChzaW1wbGUsIG5vbkhlbHBlcik7XG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuc3RyaWN0KSB7XG4gICAgICBsb29rdXAucHVzaCgnIHx8ICcsIHRoaXMuYWxpYXNhYmxlKCdoZWxwZXJzLmhlbHBlck1pc3NpbmcnKSk7XG4gICAgfVxuICAgIGxvb2t1cC5wdXNoKCcpJyk7XG5cbiAgICB0aGlzLnB1c2godGhpcy5zb3VyY2UuZnVuY3Rpb25DYWxsKGxvb2t1cCwgJ2NhbGwnLCBoZWxwZXIuY2FsbFBhcmFtcykpO1xuICB9LFxuXG4gIC8vIFtpbnZva2VLbm93bkhlbHBlcl1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgaGVscGVyIGludm9jYXRpb25cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gaXMgdXNlZCB3aGVuIHRoZSBoZWxwZXIgaXMga25vd24gdG8gZXhpc3QsXG4gIC8vIHNvIGEgYGhlbHBlck1pc3NpbmdgIGZhbGxiYWNrIGlzIG5vdCByZXF1aXJlZC5cbiAgaW52b2tlS25vd25IZWxwZXI6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgbmFtZSkge1xuICAgIGxldCBoZWxwZXIgPSB0aGlzLnNldHVwSGVscGVyKHBhcmFtU2l6ZSwgbmFtZSk7XG4gICAgdGhpcy5wdXNoKHRoaXMuc291cmNlLmZ1bmN0aW9uQ2FsbChoZWxwZXIubmFtZSwgJ2NhbGwnLCBoZWxwZXIuY2FsbFBhcmFtcykpO1xuICB9LFxuXG4gIC8vIFtpbnZva2VBbWJpZ3VvdXNdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHBhcmFtcy4uLiwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzdWx0IG9mIGRpc2FtYmlndWF0aW9uXG4gIC8vXG4gIC8vIFRoaXMgb3BlcmF0aW9uIGlzIHVzZWQgd2hlbiBhbiBleHByZXNzaW9uIGxpa2UgYHt7Zm9vfX1gXG4gIC8vIGlzIHByb3ZpZGVkLCBidXQgd2UgZG9uJ3Qga25vdyBhdCBjb21waWxlLXRpbWUgd2hldGhlciBpdFxuICAvLyBpcyBhIGhlbHBlciBvciBhIHBhdGguXG4gIC8vXG4gIC8vIFRoaXMgb3BlcmF0aW9uIGVtaXRzIG1vcmUgY29kZSB0aGFuIHRoZSBvdGhlciBvcHRpb25zLFxuICAvLyBhbmQgY2FuIGJlIGF2b2lkZWQgYnkgcGFzc2luZyB0aGUgYGtub3duSGVscGVyc2AgYW5kXG4gIC8vIGBrbm93bkhlbHBlcnNPbmx5YCBmbGFncyBhdCBjb21waWxlLXRpbWUuXG4gIGludm9rZUFtYmlndW91czogZnVuY3Rpb24obmFtZSwgaGVscGVyQ2FsbCkge1xuICAgIHRoaXMudXNlUmVnaXN0ZXIoJ2hlbHBlcicpO1xuXG4gICAgbGV0IG5vbkhlbHBlciA9IHRoaXMucG9wU3RhY2soKTtcblxuICAgIHRoaXMuZW1wdHlIYXNoKCk7XG4gICAgbGV0IGhlbHBlciA9IHRoaXMuc2V0dXBIZWxwZXIoMCwgbmFtZSwgaGVscGVyQ2FsbCk7XG5cbiAgICBsZXQgaGVscGVyTmFtZSA9IHRoaXMubGFzdEhlbHBlciA9IHRoaXMubmFtZUxvb2t1cCgnaGVscGVycycsIG5hbWUsICdoZWxwZXInKTtcblxuICAgIGxldCBsb29rdXAgPSBbJygnLCAnKGhlbHBlciA9ICcsIGhlbHBlck5hbWUsICcgfHwgJywgbm9uSGVscGVyLCAnKSddO1xuICAgIGlmICghdGhpcy5vcHRpb25zLnN0cmljdCkge1xuICAgICAgbG9va3VwWzBdID0gJyhoZWxwZXIgPSAnO1xuICAgICAgbG9va3VwLnB1c2goXG4gICAgICAgICcgIT0gbnVsbCA/IGhlbHBlciA6ICcsXG4gICAgICAgIHRoaXMuYWxpYXNhYmxlKCdoZWxwZXJzLmhlbHBlck1pc3NpbmcnKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLnB1c2goW1xuICAgICAgICAnKCcsIGxvb2t1cCxcbiAgICAgICAgKGhlbHBlci5wYXJhbXNJbml0ID8gWycpLCgnLCBoZWxwZXIucGFyYW1zSW5pdF0gOiBbXSksICcpLCcsXG4gICAgICAgICcodHlwZW9mIGhlbHBlciA9PT0gJywgdGhpcy5hbGlhc2FibGUoJ1wiZnVuY3Rpb25cIicpLCAnID8gJyxcbiAgICAgICAgdGhpcy5zb3VyY2UuZnVuY3Rpb25DYWxsKCdoZWxwZXInLCAnY2FsbCcsIGhlbHBlci5jYWxsUGFyYW1zKSwgJyA6IGhlbHBlcikpJ1xuICAgIF0pO1xuICB9LFxuXG4gIC8vIFtpbnZva2VQYXJ0aWFsXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBjb250ZXh0LCAuLi5cbiAgLy8gT24gc3RhY2sgYWZ0ZXI6IHJlc3VsdCBvZiBwYXJ0aWFsIGludm9jYXRpb25cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gcG9wcyBvZmYgYSBjb250ZXh0LCBpbnZva2VzIGEgcGFydGlhbCB3aXRoIHRoYXQgY29udGV4dCxcbiAgLy8gYW5kIHB1c2hlcyB0aGUgcmVzdWx0IG9mIHRoZSBpbnZvY2F0aW9uIGJhY2suXG4gIGludm9rZVBhcnRpYWw6IGZ1bmN0aW9uKGlzRHluYW1pYywgbmFtZSwgaW5kZW50KSB7XG4gICAgbGV0IHBhcmFtcyA9IFtdLFxuICAgICAgICBvcHRpb25zID0gdGhpcy5zZXR1cFBhcmFtcyhuYW1lLCAxLCBwYXJhbXMpO1xuXG4gICAgaWYgKGlzRHluYW1pYykge1xuICAgICAgbmFtZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLm5hbWU7XG4gICAgfVxuXG4gICAgaWYgKGluZGVudCkge1xuICAgICAgb3B0aW9ucy5pbmRlbnQgPSBKU09OLnN0cmluZ2lmeShpbmRlbnQpO1xuICAgIH1cbiAgICBvcHRpb25zLmhlbHBlcnMgPSAnaGVscGVycyc7XG4gICAgb3B0aW9ucy5wYXJ0aWFscyA9ICdwYXJ0aWFscyc7XG4gICAgb3B0aW9ucy5kZWNvcmF0b3JzID0gJ2NvbnRhaW5lci5kZWNvcmF0b3JzJztcblxuICAgIGlmICghaXNEeW5hbWljKSB7XG4gICAgICBwYXJhbXMudW5zaGlmdCh0aGlzLm5hbWVMb29rdXAoJ3BhcnRpYWxzJywgbmFtZSwgJ3BhcnRpYWwnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcy51bnNoaWZ0KG5hbWUpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuY29tcGF0KSB7XG4gICAgICBvcHRpb25zLmRlcHRocyA9ICdkZXB0aHMnO1xuICAgIH1cbiAgICBvcHRpb25zID0gdGhpcy5vYmplY3RMaXRlcmFsKG9wdGlvbnMpO1xuICAgIHBhcmFtcy5wdXNoKG9wdGlvbnMpO1xuXG4gICAgdGhpcy5wdXNoKHRoaXMuc291cmNlLmZ1bmN0aW9uQ2FsbCgnY29udGFpbmVyLmludm9rZVBhcnRpYWwnLCAnJywgcGFyYW1zKSk7XG4gIH0sXG5cbiAgLy8gW2Fzc2lnblRvSGFzaF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLiwgaGFzaCwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uLCBoYXNoLCAuLi5cbiAgLy9cbiAgLy8gUG9wcyBhIHZhbHVlIG9mZiB0aGUgc3RhY2sgYW5kIGFzc2lnbnMgaXQgdG8gdGhlIGN1cnJlbnQgaGFzaFxuICBhc3NpZ25Ub0hhc2g6IGZ1bmN0aW9uKGtleSkge1xuICAgIGxldCB2YWx1ZSA9IHRoaXMucG9wU3RhY2soKSxcbiAgICAgICAgY29udGV4dCxcbiAgICAgICAgdHlwZSxcbiAgICAgICAgaWQ7XG5cbiAgICBpZiAodGhpcy50cmFja0lkcykge1xuICAgICAgaWQgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0cmluZ1BhcmFtcykge1xuICAgICAgdHlwZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIGNvbnRleHQgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuXG4gICAgbGV0IGhhc2ggPSB0aGlzLmhhc2g7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGhhc2guY29udGV4dHNba2V5XSA9IGNvbnRleHQ7XG4gICAgfVxuICAgIGlmICh0eXBlKSB7XG4gICAgICBoYXNoLnR5cGVzW2tleV0gPSB0eXBlO1xuICAgIH1cbiAgICBpZiAoaWQpIHtcbiAgICAgIGhhc2guaWRzW2tleV0gPSBpZDtcbiAgICB9XG4gICAgaGFzaC52YWx1ZXNba2V5XSA9IHZhbHVlO1xuICB9LFxuXG4gIHB1c2hJZDogZnVuY3Rpb24odHlwZSwgbmFtZSwgY2hpbGQpIHtcbiAgICBpZiAodHlwZSA9PT0gJ0Jsb2NrUGFyYW0nKSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoXG4gICAgICAgICAgJ2Jsb2NrUGFyYW1zWycgKyBuYW1lWzBdICsgJ10ucGF0aFsnICsgbmFtZVsxXSArICddJ1xuICAgICAgICAgICsgKGNoaWxkID8gJyArICcgKyBKU09OLnN0cmluZ2lmeSgnLicgKyBjaGlsZCkgOiAnJykpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1BhdGhFeHByZXNzaW9uJykge1xuICAgICAgdGhpcy5wdXNoU3RyaW5nKG5hbWUpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1N1YkV4cHJlc3Npb24nKSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ3RydWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCdudWxsJyk7XG4gICAgfVxuICB9LFxuXG4gIC8vIEhFTFBFUlNcblxuICBjb21waWxlcjogSmF2YVNjcmlwdENvbXBpbGVyLFxuXG4gIGNvbXBpbGVDaGlsZHJlbjogZnVuY3Rpb24oZW52aXJvbm1lbnQsIG9wdGlvbnMpIHtcbiAgICBsZXQgY2hpbGRyZW4gPSBlbnZpcm9ubWVudC5jaGlsZHJlbiwgY2hpbGQsIGNvbXBpbGVyO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGNoaWxkID0gY2hpbGRyZW5baV07XG4gICAgICBjb21waWxlciA9IG5ldyB0aGlzLmNvbXBpbGVyKCk7ICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbmV3LWNhcFxuXG4gICAgICBsZXQgZXhpc3RpbmcgPSB0aGlzLm1hdGNoRXhpc3RpbmdQcm9ncmFtKGNoaWxkKTtcblxuICAgICAgaWYgKGV4aXN0aW5nID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zLnB1c2goJycpOyAgICAgLy8gUGxhY2Vob2xkZXIgdG8gcHJldmVudCBuYW1lIGNvbmZsaWN0cyBmb3IgbmVzdGVkIGNoaWxkcmVuXG4gICAgICAgIGxldCBpbmRleCA9IHRoaXMuY29udGV4dC5wcm9ncmFtcy5sZW5ndGg7XG4gICAgICAgIGNoaWxkLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIGNoaWxkLm5hbWUgPSAncHJvZ3JhbScgKyBpbmRleDtcbiAgICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zW2luZGV4XSA9IGNvbXBpbGVyLmNvbXBpbGUoY2hpbGQsIG9wdGlvbnMsIHRoaXMuY29udGV4dCwgIXRoaXMucHJlY29tcGlsZSk7XG4gICAgICAgIHRoaXMuY29udGV4dC5kZWNvcmF0b3JzW2luZGV4XSA9IGNvbXBpbGVyLmRlY29yYXRvcnM7XG4gICAgICAgIHRoaXMuY29udGV4dC5lbnZpcm9ubWVudHNbaW5kZXhdID0gY2hpbGQ7XG5cbiAgICAgICAgdGhpcy51c2VEZXB0aHMgPSB0aGlzLnVzZURlcHRocyB8fCBjb21waWxlci51c2VEZXB0aHM7XG4gICAgICAgIHRoaXMudXNlQmxvY2tQYXJhbXMgPSB0aGlzLnVzZUJsb2NrUGFyYW1zIHx8IGNvbXBpbGVyLnVzZUJsb2NrUGFyYW1zO1xuICAgICAgICBjaGlsZC51c2VEZXB0aHMgPSB0aGlzLnVzZURlcHRocztcbiAgICAgICAgY2hpbGQudXNlQmxvY2tQYXJhbXMgPSB0aGlzLnVzZUJsb2NrUGFyYW1zO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hpbGQuaW5kZXggPSBleGlzdGluZy5pbmRleDtcbiAgICAgICAgY2hpbGQubmFtZSA9ICdwcm9ncmFtJyArIGV4aXN0aW5nLmluZGV4O1xuXG4gICAgICAgIHRoaXMudXNlRGVwdGhzID0gdGhpcy51c2VEZXB0aHMgfHwgZXhpc3RpbmcudXNlRGVwdGhzO1xuICAgICAgICB0aGlzLnVzZUJsb2NrUGFyYW1zID0gdGhpcy51c2VCbG9ja1BhcmFtcyB8fCBleGlzdGluZy51c2VCbG9ja1BhcmFtcztcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIG1hdGNoRXhpc3RpbmdQcm9ncmFtOiBmdW5jdGlvbihjaGlsZCkge1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBsZXQgZW52aXJvbm1lbnQgPSB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzW2ldO1xuICAgICAgaWYgKGVudmlyb25tZW50ICYmIGVudmlyb25tZW50LmVxdWFscyhjaGlsZCkpIHtcbiAgICAgICAgcmV0dXJuIGVudmlyb25tZW50O1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwcm9ncmFtRXhwcmVzc2lvbjogZnVuY3Rpb24oZ3VpZCkge1xuICAgIGxldCBjaGlsZCA9IHRoaXMuZW52aXJvbm1lbnQuY2hpbGRyZW5bZ3VpZF0sXG4gICAgICAgIHByb2dyYW1QYXJhbXMgPSBbY2hpbGQuaW5kZXgsICdkYXRhJywgY2hpbGQuYmxvY2tQYXJhbXNdO1xuXG4gICAgaWYgKHRoaXMudXNlQmxvY2tQYXJhbXMgfHwgdGhpcy51c2VEZXB0aHMpIHtcbiAgICAgIHByb2dyYW1QYXJhbXMucHVzaCgnYmxvY2tQYXJhbXMnKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudXNlRGVwdGhzKSB7XG4gICAgICBwcm9ncmFtUGFyYW1zLnB1c2goJ2RlcHRocycpO1xuICAgIH1cblxuICAgIHJldHVybiAnY29udGFpbmVyLnByb2dyYW0oJyArIHByb2dyYW1QYXJhbXMuam9pbignLCAnKSArICcpJztcbiAgfSxcblxuICB1c2VSZWdpc3RlcjogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmICghdGhpcy5yZWdpc3RlcnNbbmFtZV0pIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzW25hbWVdID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLmxpc3QucHVzaChuYW1lKTtcbiAgICB9XG4gIH0sXG5cbiAgcHVzaDogZnVuY3Rpb24oZXhwcikge1xuICAgIGlmICghKGV4cHIgaW5zdGFuY2VvZiBMaXRlcmFsKSkge1xuICAgICAgZXhwciA9IHRoaXMuc291cmNlLndyYXAoZXhwcik7XG4gICAgfVxuXG4gICAgdGhpcy5pbmxpbmVTdGFjay5wdXNoKGV4cHIpO1xuICAgIHJldHVybiBleHByO1xuICB9LFxuXG4gIHB1c2hTdGFja0xpdGVyYWw6IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICB0aGlzLnB1c2gobmV3IExpdGVyYWwoaXRlbSkpO1xuICB9LFxuXG4gIHB1c2hTb3VyY2U6IGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb250ZW50KSB7XG4gICAgICB0aGlzLnNvdXJjZS5wdXNoKFxuICAgICAgICAgIHRoaXMuYXBwZW5kVG9CdWZmZXIodGhpcy5zb3VyY2UucXVvdGVkU3RyaW5nKHRoaXMucGVuZGluZ0NvbnRlbnQpLCB0aGlzLnBlbmRpbmdMb2NhdGlvbikpO1xuICAgICAgdGhpcy5wZW5kaW5nQ29udGVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAoc291cmNlKSB7XG4gICAgICB0aGlzLnNvdXJjZS5wdXNoKHNvdXJjZSk7XG4gICAgfVxuICB9LFxuXG4gIHJlcGxhY2VTdGFjazogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBsZXQgcHJlZml4ID0gWycoJ10sXG4gICAgICAgIHN0YWNrLFxuICAgICAgICBjcmVhdGVkU3RhY2ssXG4gICAgICAgIHVzZWRMaXRlcmFsO1xuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAoIXRoaXMuaXNJbmxpbmUoKSkge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbigncmVwbGFjZVN0YWNrIG9uIG5vbi1pbmxpbmUnKTtcbiAgICB9XG5cbiAgICAvLyBXZSB3YW50IHRvIG1lcmdlIHRoZSBpbmxpbmUgc3RhdGVtZW50IGludG8gdGhlIHJlcGxhY2VtZW50IHN0YXRlbWVudCB2aWEgJywnXG4gICAgbGV0IHRvcCA9IHRoaXMucG9wU3RhY2sodHJ1ZSk7XG5cbiAgICBpZiAodG9wIGluc3RhbmNlb2YgTGl0ZXJhbCkge1xuICAgICAgLy8gTGl0ZXJhbHMgZG8gbm90IG5lZWQgdG8gYmUgaW5saW5lZFxuICAgICAgc3RhY2sgPSBbdG9wLnZhbHVlXTtcbiAgICAgIHByZWZpeCA9IFsnKCcsIHN0YWNrXTtcbiAgICAgIHVzZWRMaXRlcmFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gR2V0IG9yIGNyZWF0ZSB0aGUgY3VycmVudCBzdGFjayBuYW1lIGZvciB1c2UgYnkgdGhlIGlubGluZVxuICAgICAgY3JlYXRlZFN0YWNrID0gdHJ1ZTtcbiAgICAgIGxldCBuYW1lID0gdGhpcy5pbmNyU3RhY2soKTtcblxuICAgICAgcHJlZml4ID0gWycoKCcsIHRoaXMucHVzaChuYW1lKSwgJyA9ICcsIHRvcCwgJyknXTtcbiAgICAgIHN0YWNrID0gdGhpcy50b3BTdGFjaygpO1xuICAgIH1cblxuICAgIGxldCBpdGVtID0gY2FsbGJhY2suY2FsbCh0aGlzLCBzdGFjayk7XG5cbiAgICBpZiAoIXVzZWRMaXRlcmFsKSB7XG4gICAgICB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuICAgIGlmIChjcmVhdGVkU3RhY2spIHtcbiAgICAgIHRoaXMuc3RhY2tTbG90LS07XG4gICAgfVxuICAgIHRoaXMucHVzaChwcmVmaXguY29uY2F0KGl0ZW0sICcpJykpO1xuICB9LFxuXG4gIGluY3JTdGFjazogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGFja1Nsb3QrKztcbiAgICBpZiAodGhpcy5zdGFja1Nsb3QgPiB0aGlzLnN0YWNrVmFycy5sZW5ndGgpIHsgdGhpcy5zdGFja1ZhcnMucHVzaCgnc3RhY2snICsgdGhpcy5zdGFja1Nsb3QpOyB9XG4gICAgcmV0dXJuIHRoaXMudG9wU3RhY2tOYW1lKCk7XG4gIH0sXG4gIHRvcFN0YWNrTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICdzdGFjaycgKyB0aGlzLnN0YWNrU2xvdDtcbiAgfSxcbiAgZmx1c2hJbmxpbmU6IGZ1bmN0aW9uKCkge1xuICAgIGxldCBpbmxpbmVTdGFjayA9IHRoaXMuaW5saW5lU3RhY2s7XG4gICAgdGhpcy5pbmxpbmVTdGFjayA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbmxpbmVTdGFjay5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGVudHJ5ID0gaW5saW5lU3RhY2tbaV07XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChlbnRyeSBpbnN0YW5jZW9mIExpdGVyYWwpIHtcbiAgICAgICAgdGhpcy5jb21waWxlU3RhY2sucHVzaChlbnRyeSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgc3RhY2sgPSB0aGlzLmluY3JTdGFjaygpO1xuICAgICAgICB0aGlzLnB1c2hTb3VyY2UoW3N0YWNrLCAnID0gJywgZW50cnksICc7J10pO1xuICAgICAgICB0aGlzLmNvbXBpbGVTdGFjay5wdXNoKHN0YWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGlzSW5saW5lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pbmxpbmVTdGFjay5sZW5ndGg7XG4gIH0sXG5cbiAgcG9wU3RhY2s6IGZ1bmN0aW9uKHdyYXBwZWQpIHtcbiAgICBsZXQgaW5saW5lID0gdGhpcy5pc0lubGluZSgpLFxuICAgICAgICBpdGVtID0gKGlubGluZSA/IHRoaXMuaW5saW5lU3RhY2sgOiB0aGlzLmNvbXBpbGVTdGFjaykucG9wKCk7XG5cbiAgICBpZiAoIXdyYXBwZWQgJiYgKGl0ZW0gaW5zdGFuY2VvZiBMaXRlcmFsKSkge1xuICAgICAgcmV0dXJuIGl0ZW0udmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghaW5saW5lKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgIGlmICghdGhpcy5zdGFja1Nsb3QpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdJbnZhbGlkIHN0YWNrIHBvcCcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhY2tTbG90LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9XG4gIH0sXG5cbiAgdG9wU3RhY2s6IGZ1bmN0aW9uKCkge1xuICAgIGxldCBzdGFjayA9ICh0aGlzLmlzSW5saW5lKCkgPyB0aGlzLmlubGluZVN0YWNrIDogdGhpcy5jb21waWxlU3RhY2spLFxuICAgICAgICBpdGVtID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIExpdGVyYWwpIHtcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9XG4gIH0sXG5cbiAgY29udGV4dE5hbWU6IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgICBpZiAodGhpcy51c2VEZXB0aHMgJiYgY29udGV4dCkge1xuICAgICAgcmV0dXJuICdkZXB0aHNbJyArIGNvbnRleHQgKyAnXSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnZGVwdGgnICsgY29udGV4dDtcbiAgICB9XG4gIH0sXG5cbiAgcXVvdGVkU3RyaW5nOiBmdW5jdGlvbihzdHIpIHtcbiAgICByZXR1cm4gdGhpcy5zb3VyY2UucXVvdGVkU3RyaW5nKHN0cik7XG4gIH0sXG5cbiAgb2JqZWN0TGl0ZXJhbDogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlLm9iamVjdExpdGVyYWwob2JqKTtcbiAgfSxcblxuICBhbGlhc2FibGU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBsZXQgcmV0ID0gdGhpcy5hbGlhc2VzW25hbWVdO1xuICAgIGlmIChyZXQpIHtcbiAgICAgIHJldC5yZWZlcmVuY2VDb3VudCsrO1xuICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG5cbiAgICByZXQgPSB0aGlzLmFsaWFzZXNbbmFtZV0gPSB0aGlzLnNvdXJjZS53cmFwKG5hbWUpO1xuICAgIHJldC5hbGlhc2FibGUgPSB0cnVlO1xuICAgIHJldC5yZWZlcmVuY2VDb3VudCA9IDE7XG5cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIHNldHVwSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUsIGJsb2NrSGVscGVyKSB7XG4gICAgbGV0IHBhcmFtcyA9IFtdLFxuICAgICAgICBwYXJhbXNJbml0ID0gdGhpcy5zZXR1cEhlbHBlckFyZ3MobmFtZSwgcGFyYW1TaXplLCBwYXJhbXMsIGJsb2NrSGVscGVyKTtcbiAgICBsZXQgZm91bmRIZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2hlbHBlcnMnLCBuYW1lLCAnaGVscGVyJyksXG4gICAgICAgIGNhbGxDb250ZXh0ID0gdGhpcy5hbGlhc2FibGUoYCR7dGhpcy5jb250ZXh0TmFtZSgwKX0gIT0gbnVsbCA/ICR7dGhpcy5jb250ZXh0TmFtZSgwKX0gOiAoY29udGFpbmVyLm51bGxDb250ZXh0IHx8IHt9KWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgcGFyYW1zSW5pdDogcGFyYW1zSW5pdCxcbiAgICAgIG5hbWU6IGZvdW5kSGVscGVyLFxuICAgICAgY2FsbFBhcmFtczogW2NhbGxDb250ZXh0XS5jb25jYXQocGFyYW1zKVxuICAgIH07XG4gIH0sXG5cbiAgc2V0dXBQYXJhbXM6IGZ1bmN0aW9uKGhlbHBlciwgcGFyYW1TaXplLCBwYXJhbXMpIHtcbiAgICBsZXQgb3B0aW9ucyA9IHt9LFxuICAgICAgICBjb250ZXh0cyA9IFtdLFxuICAgICAgICB0eXBlcyA9IFtdLFxuICAgICAgICBpZHMgPSBbXSxcbiAgICAgICAgb2JqZWN0QXJncyA9ICFwYXJhbXMsXG4gICAgICAgIHBhcmFtO1xuXG4gICAgaWYgKG9iamVjdEFyZ3MpIHtcbiAgICAgIHBhcmFtcyA9IFtdO1xuICAgIH1cblxuICAgIG9wdGlvbnMubmFtZSA9IHRoaXMucXVvdGVkU3RyaW5nKGhlbHBlcik7XG4gICAgb3B0aW9ucy5oYXNoID0gdGhpcy5wb3BTdGFjaygpO1xuXG4gICAgaWYgKHRoaXMudHJhY2tJZHMpIHtcbiAgICAgIG9wdGlvbnMuaGFzaElkcyA9IHRoaXMucG9wU3RhY2soKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICBvcHRpb25zLmhhc2hUeXBlcyA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIG9wdGlvbnMuaGFzaENvbnRleHRzID0gdGhpcy5wb3BTdGFjaygpO1xuICAgIH1cblxuICAgIGxldCBpbnZlcnNlID0gdGhpcy5wb3BTdGFjaygpLFxuICAgICAgICBwcm9ncmFtID0gdGhpcy5wb3BTdGFjaygpO1xuXG4gICAgLy8gQXZvaWQgc2V0dGluZyBmbiBhbmQgaW52ZXJzZSBpZiBuZWl0aGVyIGFyZSBzZXQuIFRoaXMgYWxsb3dzXG4gICAgLy8gaGVscGVycyB0byBkbyBhIGNoZWNrIGZvciBgaWYgKG9wdGlvbnMuZm4pYFxuICAgIGlmIChwcm9ncmFtIHx8IGludmVyc2UpIHtcbiAgICAgIG9wdGlvbnMuZm4gPSBwcm9ncmFtIHx8ICdjb250YWluZXIubm9vcCc7XG4gICAgICBvcHRpb25zLmludmVyc2UgPSBpbnZlcnNlIHx8ICdjb250YWluZXIubm9vcCc7XG4gICAgfVxuXG4gICAgLy8gVGhlIHBhcmFtZXRlcnMgZ28gb24gdG8gdGhlIHN0YWNrIGluIG9yZGVyIChtYWtpbmcgc3VyZSB0aGF0IHRoZXkgYXJlIGV2YWx1YXRlZCBpbiBvcmRlcilcbiAgICAvLyBzbyB3ZSBuZWVkIHRvIHBvcCB0aGVtIG9mZiB0aGUgc3RhY2sgaW4gcmV2ZXJzZSBvcmRlclxuICAgIGxldCBpID0gcGFyYW1TaXplO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHBhcmFtID0gdGhpcy5wb3BTdGFjaygpO1xuICAgICAgcGFyYW1zW2ldID0gcGFyYW07XG5cbiAgICAgIGlmICh0aGlzLnRyYWNrSWRzKSB7XG4gICAgICAgIGlkc1tpXSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnN0cmluZ1BhcmFtcykge1xuICAgICAgICB0eXBlc1tpXSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgICAgY29udGV4dHNbaV0gPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9iamVjdEFyZ3MpIHtcbiAgICAgIG9wdGlvbnMuYXJncyA9IHRoaXMuc291cmNlLmdlbmVyYXRlQXJyYXkocGFyYW1zKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy50cmFja0lkcykge1xuICAgICAgb3B0aW9ucy5pZHMgPSB0aGlzLnNvdXJjZS5nZW5lcmF0ZUFycmF5KGlkcyk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0cmluZ1BhcmFtcykge1xuICAgICAgb3B0aW9ucy50eXBlcyA9IHRoaXMuc291cmNlLmdlbmVyYXRlQXJyYXkodHlwZXMpO1xuICAgICAgb3B0aW9ucy5jb250ZXh0cyA9IHRoaXMuc291cmNlLmdlbmVyYXRlQXJyYXkoY29udGV4dHMpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGF0YSkge1xuICAgICAgb3B0aW9ucy5kYXRhID0gJ2RhdGEnO1xuICAgIH1cbiAgICBpZiAodGhpcy51c2VCbG9ja1BhcmFtcykge1xuICAgICAgb3B0aW9ucy5ibG9ja1BhcmFtcyA9ICdibG9ja1BhcmFtcyc7XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xuICB9LFxuXG4gIHNldHVwSGVscGVyQXJnczogZnVuY3Rpb24oaGVscGVyLCBwYXJhbVNpemUsIHBhcmFtcywgdXNlUmVnaXN0ZXIpIHtcbiAgICBsZXQgb3B0aW9ucyA9IHRoaXMuc2V0dXBQYXJhbXMoaGVscGVyLCBwYXJhbVNpemUsIHBhcmFtcyk7XG4gICAgb3B0aW9ucyA9IHRoaXMub2JqZWN0TGl0ZXJhbChvcHRpb25zKTtcbiAgICBpZiAodXNlUmVnaXN0ZXIpIHtcbiAgICAgIHRoaXMudXNlUmVnaXN0ZXIoJ29wdGlvbnMnKTtcbiAgICAgIHBhcmFtcy5wdXNoKCdvcHRpb25zJyk7XG4gICAgICByZXR1cm4gWydvcHRpb25zPScsIG9wdGlvbnNdO1xuICAgIH0gZWxzZSBpZiAocGFyYW1zKSB7XG4gICAgICBwYXJhbXMucHVzaChvcHRpb25zKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgfVxuICB9XG59O1xuXG5cbihmdW5jdGlvbigpIHtcbiAgY29uc3QgcmVzZXJ2ZWRXb3JkcyA9IChcbiAgICAnYnJlYWsgZWxzZSBuZXcgdmFyJyArXG4gICAgJyBjYXNlIGZpbmFsbHkgcmV0dXJuIHZvaWQnICtcbiAgICAnIGNhdGNoIGZvciBzd2l0Y2ggd2hpbGUnICtcbiAgICAnIGNvbnRpbnVlIGZ1bmN0aW9uIHRoaXMgd2l0aCcgK1xuICAgICcgZGVmYXVsdCBpZiB0aHJvdycgK1xuICAgICcgZGVsZXRlIGluIHRyeScgK1xuICAgICcgZG8gaW5zdGFuY2VvZiB0eXBlb2YnICtcbiAgICAnIGFic3RyYWN0IGVudW0gaW50IHNob3J0JyArXG4gICAgJyBib29sZWFuIGV4cG9ydCBpbnRlcmZhY2Ugc3RhdGljJyArXG4gICAgJyBieXRlIGV4dGVuZHMgbG9uZyBzdXBlcicgK1xuICAgICcgY2hhciBmaW5hbCBuYXRpdmUgc3luY2hyb25pemVkJyArXG4gICAgJyBjbGFzcyBmbG9hdCBwYWNrYWdlIHRocm93cycgK1xuICAgICcgY29uc3QgZ290byBwcml2YXRlIHRyYW5zaWVudCcgK1xuICAgICcgZGVidWdnZXIgaW1wbGVtZW50cyBwcm90ZWN0ZWQgdm9sYXRpbGUnICtcbiAgICAnIGRvdWJsZSBpbXBvcnQgcHVibGljIGxldCB5aWVsZCBhd2FpdCcgK1xuICAgICcgbnVsbCB0cnVlIGZhbHNlJ1xuICApLnNwbGl0KCcgJyk7XG5cbiAgY29uc3QgY29tcGlsZXJXb3JkcyA9IEphdmFTY3JpcHRDb21waWxlci5SRVNFUlZFRF9XT1JEUyA9IHt9O1xuXG4gIGZvciAobGV0IGkgPSAwLCBsID0gcmVzZXJ2ZWRXb3Jkcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb21waWxlcldvcmRzW3Jlc2VydmVkV29yZHNbaV1dID0gdHJ1ZTtcbiAgfVxufSgpKTtcblxuSmF2YVNjcmlwdENvbXBpbGVyLmlzVmFsaWRKYXZhU2NyaXB0VmFyaWFibGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICByZXR1cm4gIUphdmFTY3JpcHRDb21waWxlci5SRVNFUlZFRF9XT1JEU1tuYW1lXSAmJiAoL15bYS16QS1aXyRdWzAtOWEtekEtWl8kXSokLykudGVzdChuYW1lKTtcbn07XG5cbmZ1bmN0aW9uIHN0cmljdExvb2t1cChyZXF1aXJlVGVybWluYWwsIGNvbXBpbGVyLCBwYXJ0cywgdHlwZSkge1xuICBsZXQgc3RhY2sgPSBjb21waWxlci5wb3BTdGFjaygpLFxuICAgICAgaSA9IDAsXG4gICAgICBsZW4gPSBwYXJ0cy5sZW5ndGg7XG4gIGlmIChyZXF1aXJlVGVybWluYWwpIHtcbiAgICBsZW4tLTtcbiAgfVxuXG4gIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBzdGFjayA9IGNvbXBpbGVyLm5hbWVMb29rdXAoc3RhY2ssIHBhcnRzW2ldLCB0eXBlKTtcbiAgfVxuXG4gIGlmIChyZXF1aXJlVGVybWluYWwpIHtcbiAgICByZXR1cm4gW2NvbXBpbGVyLmFsaWFzYWJsZSgnY29udGFpbmVyLnN0cmljdCcpLCAnKCcsIHN0YWNrLCAnLCAnLCBjb21waWxlci5xdW90ZWRTdHJpbmcocGFydHNbaV0pLCAnKSddO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdGFjaztcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKYXZhU2NyaXB0Q29tcGlsZXI7XG4iLCIvLyBGaWxlIGlnbm9yZWQgaW4gY292ZXJhZ2UgdGVzdHMgdmlhIHNldHRpbmcgaW4gLmlzdGFuYnVsLnltbFxuLyogSmlzb24gZ2VuZXJhdGVkIHBhcnNlciAqL1xudmFyIGhhbmRsZWJhcnMgPSAoZnVuY3Rpb24oKXtcbnZhciBwYXJzZXIgPSB7dHJhY2U6IGZ1bmN0aW9uIHRyYWNlKCkgeyB9LFxueXk6IHt9LFxuc3ltYm9sc186IHtcImVycm9yXCI6MixcInJvb3RcIjozLFwicHJvZ3JhbVwiOjQsXCJFT0ZcIjo1LFwicHJvZ3JhbV9yZXBldGl0aW9uMFwiOjYsXCJzdGF0ZW1lbnRcIjo3LFwibXVzdGFjaGVcIjo4LFwiYmxvY2tcIjo5LFwicmF3QmxvY2tcIjoxMCxcInBhcnRpYWxcIjoxMSxcInBhcnRpYWxCbG9ja1wiOjEyLFwiY29udGVudFwiOjEzLFwiQ09NTUVOVFwiOjE0LFwiQ09OVEVOVFwiOjE1LFwib3BlblJhd0Jsb2NrXCI6MTYsXCJyYXdCbG9ja19yZXBldGl0aW9uX3BsdXMwXCI6MTcsXCJFTkRfUkFXX0JMT0NLXCI6MTgsXCJPUEVOX1JBV19CTE9DS1wiOjE5LFwiaGVscGVyTmFtZVwiOjIwLFwib3BlblJhd0Jsb2NrX3JlcGV0aXRpb24wXCI6MjEsXCJvcGVuUmF3QmxvY2tfb3B0aW9uMFwiOjIyLFwiQ0xPU0VfUkFXX0JMT0NLXCI6MjMsXCJvcGVuQmxvY2tcIjoyNCxcImJsb2NrX29wdGlvbjBcIjoyNSxcImNsb3NlQmxvY2tcIjoyNixcIm9wZW5JbnZlcnNlXCI6MjcsXCJibG9ja19vcHRpb24xXCI6MjgsXCJPUEVOX0JMT0NLXCI6MjksXCJvcGVuQmxvY2tfcmVwZXRpdGlvbjBcIjozMCxcIm9wZW5CbG9ja19vcHRpb24wXCI6MzEsXCJvcGVuQmxvY2tfb3B0aW9uMVwiOjMyLFwiQ0xPU0VcIjozMyxcIk9QRU5fSU5WRVJTRVwiOjM0LFwib3BlbkludmVyc2VfcmVwZXRpdGlvbjBcIjozNSxcIm9wZW5JbnZlcnNlX29wdGlvbjBcIjozNixcIm9wZW5JbnZlcnNlX29wdGlvbjFcIjozNyxcIm9wZW5JbnZlcnNlQ2hhaW5cIjozOCxcIk9QRU5fSU5WRVJTRV9DSEFJTlwiOjM5LFwib3BlbkludmVyc2VDaGFpbl9yZXBldGl0aW9uMFwiOjQwLFwib3BlbkludmVyc2VDaGFpbl9vcHRpb24wXCI6NDEsXCJvcGVuSW52ZXJzZUNoYWluX29wdGlvbjFcIjo0MixcImludmVyc2VBbmRQcm9ncmFtXCI6NDMsXCJJTlZFUlNFXCI6NDQsXCJpbnZlcnNlQ2hhaW5cIjo0NSxcImludmVyc2VDaGFpbl9vcHRpb24wXCI6NDYsXCJPUEVOX0VOREJMT0NLXCI6NDcsXCJPUEVOXCI6NDgsXCJtdXN0YWNoZV9yZXBldGl0aW9uMFwiOjQ5LFwibXVzdGFjaGVfb3B0aW9uMFwiOjUwLFwiT1BFTl9VTkVTQ0FQRURcIjo1MSxcIm11c3RhY2hlX3JlcGV0aXRpb24xXCI6NTIsXCJtdXN0YWNoZV9vcHRpb24xXCI6NTMsXCJDTE9TRV9VTkVTQ0FQRURcIjo1NCxcIk9QRU5fUEFSVElBTFwiOjU1LFwicGFydGlhbE5hbWVcIjo1NixcInBhcnRpYWxfcmVwZXRpdGlvbjBcIjo1NyxcInBhcnRpYWxfb3B0aW9uMFwiOjU4LFwib3BlblBhcnRpYWxCbG9ja1wiOjU5LFwiT1BFTl9QQVJUSUFMX0JMT0NLXCI6NjAsXCJvcGVuUGFydGlhbEJsb2NrX3JlcGV0aXRpb24wXCI6NjEsXCJvcGVuUGFydGlhbEJsb2NrX29wdGlvbjBcIjo2MixcInBhcmFtXCI6NjMsXCJzZXhwclwiOjY0LFwiT1BFTl9TRVhQUlwiOjY1LFwic2V4cHJfcmVwZXRpdGlvbjBcIjo2NixcInNleHByX29wdGlvbjBcIjo2NyxcIkNMT1NFX1NFWFBSXCI6NjgsXCJoYXNoXCI6NjksXCJoYXNoX3JlcGV0aXRpb25fcGx1czBcIjo3MCxcImhhc2hTZWdtZW50XCI6NzEsXCJJRFwiOjcyLFwiRVFVQUxTXCI6NzMsXCJibG9ja1BhcmFtc1wiOjc0LFwiT1BFTl9CTE9DS19QQVJBTVNcIjo3NSxcImJsb2NrUGFyYW1zX3JlcGV0aXRpb25fcGx1czBcIjo3NixcIkNMT1NFX0JMT0NLX1BBUkFNU1wiOjc3LFwicGF0aFwiOjc4LFwiZGF0YU5hbWVcIjo3OSxcIlNUUklOR1wiOjgwLFwiTlVNQkVSXCI6ODEsXCJCT09MRUFOXCI6ODIsXCJVTkRFRklORURcIjo4MyxcIk5VTExcIjo4NCxcIkRBVEFcIjo4NSxcInBhdGhTZWdtZW50c1wiOjg2LFwiU0VQXCI6ODcsXCIkYWNjZXB0XCI6MCxcIiRlbmRcIjoxfSxcbnRlcm1pbmFsc186IHsyOlwiZXJyb3JcIiw1OlwiRU9GXCIsMTQ6XCJDT01NRU5UXCIsMTU6XCJDT05URU5UXCIsMTg6XCJFTkRfUkFXX0JMT0NLXCIsMTk6XCJPUEVOX1JBV19CTE9DS1wiLDIzOlwiQ0xPU0VfUkFXX0JMT0NLXCIsMjk6XCJPUEVOX0JMT0NLXCIsMzM6XCJDTE9TRVwiLDM0OlwiT1BFTl9JTlZFUlNFXCIsMzk6XCJPUEVOX0lOVkVSU0VfQ0hBSU5cIiw0NDpcIklOVkVSU0VcIiw0NzpcIk9QRU5fRU5EQkxPQ0tcIiw0ODpcIk9QRU5cIiw1MTpcIk9QRU5fVU5FU0NBUEVEXCIsNTQ6XCJDTE9TRV9VTkVTQ0FQRURcIiw1NTpcIk9QRU5fUEFSVElBTFwiLDYwOlwiT1BFTl9QQVJUSUFMX0JMT0NLXCIsNjU6XCJPUEVOX1NFWFBSXCIsNjg6XCJDTE9TRV9TRVhQUlwiLDcyOlwiSURcIiw3MzpcIkVRVUFMU1wiLDc1OlwiT1BFTl9CTE9DS19QQVJBTVNcIiw3NzpcIkNMT1NFX0JMT0NLX1BBUkFNU1wiLDgwOlwiU1RSSU5HXCIsODE6XCJOVU1CRVJcIiw4MjpcIkJPT0xFQU5cIiw4MzpcIlVOREVGSU5FRFwiLDg0OlwiTlVMTFwiLDg1OlwiREFUQVwiLDg3OlwiU0VQXCJ9LFxucHJvZHVjdGlvbnNfOiBbMCxbMywyXSxbNCwxXSxbNywxXSxbNywxXSxbNywxXSxbNywxXSxbNywxXSxbNywxXSxbNywxXSxbMTMsMV0sWzEwLDNdLFsxNiw1XSxbOSw0XSxbOSw0XSxbMjQsNl0sWzI3LDZdLFszOCw2XSxbNDMsMl0sWzQ1LDNdLFs0NSwxXSxbMjYsM10sWzgsNV0sWzgsNV0sWzExLDVdLFsxMiwzXSxbNTksNV0sWzYzLDFdLFs2MywxXSxbNjQsNV0sWzY5LDFdLFs3MSwzXSxbNzQsM10sWzIwLDFdLFsyMCwxXSxbMjAsMV0sWzIwLDFdLFsyMCwxXSxbMjAsMV0sWzIwLDFdLFs1NiwxXSxbNTYsMV0sWzc5LDJdLFs3OCwxXSxbODYsM10sWzg2LDFdLFs2LDBdLFs2LDJdLFsxNywxXSxbMTcsMl0sWzIxLDBdLFsyMSwyXSxbMjIsMF0sWzIyLDFdLFsyNSwwXSxbMjUsMV0sWzI4LDBdLFsyOCwxXSxbMzAsMF0sWzMwLDJdLFszMSwwXSxbMzEsMV0sWzMyLDBdLFszMiwxXSxbMzUsMF0sWzM1LDJdLFszNiwwXSxbMzYsMV0sWzM3LDBdLFszNywxXSxbNDAsMF0sWzQwLDJdLFs0MSwwXSxbNDEsMV0sWzQyLDBdLFs0MiwxXSxbNDYsMF0sWzQ2LDFdLFs0OSwwXSxbNDksMl0sWzUwLDBdLFs1MCwxXSxbNTIsMF0sWzUyLDJdLFs1MywwXSxbNTMsMV0sWzU3LDBdLFs1NywyXSxbNTgsMF0sWzU4LDFdLFs2MSwwXSxbNjEsMl0sWzYyLDBdLFs2MiwxXSxbNjYsMF0sWzY2LDJdLFs2NywwXSxbNjcsMV0sWzcwLDFdLFs3MCwyXSxbNzYsMV0sWzc2LDJdXSxcbnBlcmZvcm1BY3Rpb246IGZ1bmN0aW9uIGFub255bW91cyh5eXRleHQseXlsZW5nLHl5bGluZW5vLHl5LHl5c3RhdGUsJCQsXyRcbi8qKi8pIHtcblxudmFyICQwID0gJCQubGVuZ3RoIC0gMTtcbnN3aXRjaCAoeXlzdGF0ZSkge1xuY2FzZSAxOiByZXR1cm4gJCRbJDAtMV07IFxuYnJlYWs7XG5jYXNlIDI6dGhpcy4kID0geXkucHJlcGFyZVByb2dyYW0oJCRbJDBdKTtcbmJyZWFrO1xuY2FzZSAzOnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSA0OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSA1OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSA2OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSA3OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSA4OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSA5OlxuICAgIHRoaXMuJCA9IHtcbiAgICAgIHR5cGU6ICdDb21tZW50U3RhdGVtZW50JyxcbiAgICAgIHZhbHVlOiB5eS5zdHJpcENvbW1lbnQoJCRbJDBdKSxcbiAgICAgIHN0cmlwOiB5eS5zdHJpcEZsYWdzKCQkWyQwXSwgJCRbJDBdKSxcbiAgICAgIGxvYzogeXkubG9jSW5mbyh0aGlzLl8kKVxuICAgIH07XG4gIFxuYnJlYWs7XG5jYXNlIDEwOlxuICAgIHRoaXMuJCA9IHtcbiAgICAgIHR5cGU6ICdDb250ZW50U3RhdGVtZW50JyxcbiAgICAgIG9yaWdpbmFsOiAkJFskMF0sXG4gICAgICB2YWx1ZTogJCRbJDBdLFxuICAgICAgbG9jOiB5eS5sb2NJbmZvKHRoaXMuXyQpXG4gICAgfTtcbiAgXG5icmVhaztcbmNhc2UgMTE6dGhpcy4kID0geXkucHJlcGFyZVJhd0Jsb2NrKCQkWyQwLTJdLCAkJFskMC0xXSwgJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxMjp0aGlzLiQgPSB7IHBhdGg6ICQkWyQwLTNdLCBwYXJhbXM6ICQkWyQwLTJdLCBoYXNoOiAkJFskMC0xXSB9O1xuYnJlYWs7XG5jYXNlIDEzOnRoaXMuJCA9IHl5LnByZXBhcmVCbG9jaygkJFskMC0zXSwgJCRbJDAtMl0sICQkWyQwLTFdLCAkJFskMF0sIGZhbHNlLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxNDp0aGlzLiQgPSB5eS5wcmVwYXJlQmxvY2soJCRbJDAtM10sICQkWyQwLTJdLCAkJFskMC0xXSwgJCRbJDBdLCB0cnVlLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxNTp0aGlzLiQgPSB7IG9wZW46ICQkWyQwLTVdLCBwYXRoOiAkJFskMC00XSwgcGFyYW1zOiAkJFskMC0zXSwgaGFzaDogJCRbJDAtMl0sIGJsb2NrUGFyYW1zOiAkJFskMC0xXSwgc3RyaXA6IHl5LnN0cmlwRmxhZ3MoJCRbJDAtNV0sICQkWyQwXSkgfTtcbmJyZWFrO1xuY2FzZSAxNjp0aGlzLiQgPSB7IHBhdGg6ICQkWyQwLTRdLCBwYXJhbXM6ICQkWyQwLTNdLCBoYXNoOiAkJFskMC0yXSwgYmxvY2tQYXJhbXM6ICQkWyQwLTFdLCBzdHJpcDogeXkuc3RyaXBGbGFncygkJFskMC01XSwgJCRbJDBdKSB9O1xuYnJlYWs7XG5jYXNlIDE3OnRoaXMuJCA9IHsgcGF0aDogJCRbJDAtNF0sIHBhcmFtczogJCRbJDAtM10sIGhhc2g6ICQkWyQwLTJdLCBibG9ja1BhcmFtczogJCRbJDAtMV0sIHN0cmlwOiB5eS5zdHJpcEZsYWdzKCQkWyQwLTVdLCAkJFskMF0pIH07XG5icmVhaztcbmNhc2UgMTg6dGhpcy4kID0geyBzdHJpcDogeXkuc3RyaXBGbGFncygkJFskMC0xXSwgJCRbJDAtMV0pLCBwcm9ncmFtOiAkJFskMF0gfTtcbmJyZWFrO1xuY2FzZSAxOTpcbiAgICB2YXIgaW52ZXJzZSA9IHl5LnByZXBhcmVCbG9jaygkJFskMC0yXSwgJCRbJDAtMV0sICQkWyQwXSwgJCRbJDBdLCBmYWxzZSwgdGhpcy5fJCksXG4gICAgICAgIHByb2dyYW0gPSB5eS5wcmVwYXJlUHJvZ3JhbShbaW52ZXJzZV0sICQkWyQwLTFdLmxvYyk7XG4gICAgcHJvZ3JhbS5jaGFpbmVkID0gdHJ1ZTtcblxuICAgIHRoaXMuJCA9IHsgc3RyaXA6ICQkWyQwLTJdLnN0cmlwLCBwcm9ncmFtOiBwcm9ncmFtLCBjaGFpbjogdHJ1ZSB9O1xuICBcbmJyZWFrO1xuY2FzZSAyMDp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgMjE6dGhpcy4kID0ge3BhdGg6ICQkWyQwLTFdLCBzdHJpcDogeXkuc3RyaXBGbGFncygkJFskMC0yXSwgJCRbJDBdKX07XG5icmVhaztcbmNhc2UgMjI6dGhpcy4kID0geXkucHJlcGFyZU11c3RhY2hlKCQkWyQwLTNdLCAkJFskMC0yXSwgJCRbJDAtMV0sICQkWyQwLTRdLCB5eS5zdHJpcEZsYWdzKCQkWyQwLTRdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyMzp0aGlzLiQgPSB5eS5wcmVwYXJlTXVzdGFjaGUoJCRbJDAtM10sICQkWyQwLTJdLCAkJFskMC0xXSwgJCRbJDAtNF0sIHl5LnN0cmlwRmxhZ3MoJCRbJDAtNF0sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDI0OlxuICAgIHRoaXMuJCA9IHtcbiAgICAgIHR5cGU6ICdQYXJ0aWFsU3RhdGVtZW50JyxcbiAgICAgIG5hbWU6ICQkWyQwLTNdLFxuICAgICAgcGFyYW1zOiAkJFskMC0yXSxcbiAgICAgIGhhc2g6ICQkWyQwLTFdLFxuICAgICAgaW5kZW50OiAnJyxcbiAgICAgIHN0cmlwOiB5eS5zdHJpcEZsYWdzKCQkWyQwLTRdLCAkJFskMF0pLFxuICAgICAgbG9jOiB5eS5sb2NJbmZvKHRoaXMuXyQpXG4gICAgfTtcbiAgXG5icmVhaztcbmNhc2UgMjU6dGhpcy4kID0geXkucHJlcGFyZVBhcnRpYWxCbG9jaygkJFskMC0yXSwgJCRbJDAtMV0sICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjY6dGhpcy4kID0geyBwYXRoOiAkJFskMC0zXSwgcGFyYW1zOiAkJFskMC0yXSwgaGFzaDogJCRbJDAtMV0sIHN0cmlwOiB5eS5zdHJpcEZsYWdzKCQkWyQwLTRdLCAkJFskMF0pIH07XG5icmVhaztcbmNhc2UgMjc6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDI4OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSAyOTpcbiAgICB0aGlzLiQgPSB7XG4gICAgICB0eXBlOiAnU3ViRXhwcmVzc2lvbicsXG4gICAgICBwYXRoOiAkJFskMC0zXSxcbiAgICAgIHBhcmFtczogJCRbJDAtMl0sXG4gICAgICBoYXNoOiAkJFskMC0xXSxcbiAgICAgIGxvYzogeXkubG9jSW5mbyh0aGlzLl8kKVxuICAgIH07XG4gIFxuYnJlYWs7XG5jYXNlIDMwOnRoaXMuJCA9IHt0eXBlOiAnSGFzaCcsIHBhaXJzOiAkJFskMF0sIGxvYzogeXkubG9jSW5mbyh0aGlzLl8kKX07XG5icmVhaztcbmNhc2UgMzE6dGhpcy4kID0ge3R5cGU6ICdIYXNoUGFpcicsIGtleTogeXkuaWQoJCRbJDAtMl0pLCB2YWx1ZTogJCRbJDBdLCBsb2M6IHl5LmxvY0luZm8odGhpcy5fJCl9O1xuYnJlYWs7XG5jYXNlIDMyOnRoaXMuJCA9IHl5LmlkKCQkWyQwLTFdKTtcbmJyZWFrO1xuY2FzZSAzMzp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgMzQ6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDM1OnRoaXMuJCA9IHt0eXBlOiAnU3RyaW5nTGl0ZXJhbCcsIHZhbHVlOiAkJFskMF0sIG9yaWdpbmFsOiAkJFskMF0sIGxvYzogeXkubG9jSW5mbyh0aGlzLl8kKX07XG5icmVhaztcbmNhc2UgMzY6dGhpcy4kID0ge3R5cGU6ICdOdW1iZXJMaXRlcmFsJywgdmFsdWU6IE51bWJlcigkJFskMF0pLCBvcmlnaW5hbDogTnVtYmVyKCQkWyQwXSksIGxvYzogeXkubG9jSW5mbyh0aGlzLl8kKX07XG5icmVhaztcbmNhc2UgMzc6dGhpcy4kID0ge3R5cGU6ICdCb29sZWFuTGl0ZXJhbCcsIHZhbHVlOiAkJFskMF0gPT09ICd0cnVlJywgb3JpZ2luYWw6ICQkWyQwXSA9PT0gJ3RydWUnLCBsb2M6IHl5LmxvY0luZm8odGhpcy5fJCl9O1xuYnJlYWs7XG5jYXNlIDM4OnRoaXMuJCA9IHt0eXBlOiAnVW5kZWZpbmVkTGl0ZXJhbCcsIG9yaWdpbmFsOiB1bmRlZmluZWQsIHZhbHVlOiB1bmRlZmluZWQsIGxvYzogeXkubG9jSW5mbyh0aGlzLl8kKX07XG5icmVhaztcbmNhc2UgMzk6dGhpcy4kID0ge3R5cGU6ICdOdWxsTGl0ZXJhbCcsIG9yaWdpbmFsOiBudWxsLCB2YWx1ZTogbnVsbCwgbG9jOiB5eS5sb2NJbmZvKHRoaXMuXyQpfTtcbmJyZWFrO1xuY2FzZSA0MDp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgNDE6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDQyOnRoaXMuJCA9IHl5LnByZXBhcmVQYXRoKHRydWUsICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgNDM6dGhpcy4kID0geXkucHJlcGFyZVBhdGgoZmFsc2UsICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgNDQ6ICQkWyQwLTJdLnB1c2goe3BhcnQ6IHl5LmlkKCQkWyQwXSksIG9yaWdpbmFsOiAkJFskMF0sIHNlcGFyYXRvcjogJCRbJDAtMV19KTsgdGhpcy4kID0gJCRbJDAtMl07IFxuYnJlYWs7XG5jYXNlIDQ1OnRoaXMuJCA9IFt7cGFydDogeXkuaWQoJCRbJDBdKSwgb3JpZ2luYWw6ICQkWyQwXX1dO1xuYnJlYWs7XG5jYXNlIDQ2OnRoaXMuJCA9IFtdO1xuYnJlYWs7XG5jYXNlIDQ3OiQkWyQwLTFdLnB1c2goJCRbJDBdKTtcbmJyZWFrO1xuY2FzZSA0ODp0aGlzLiQgPSBbJCRbJDBdXTtcbmJyZWFrO1xuY2FzZSA0OTokJFskMC0xXS5wdXNoKCQkWyQwXSk7XG5icmVhaztcbmNhc2UgNTA6dGhpcy4kID0gW107XG5icmVhaztcbmNhc2UgNTE6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG5jYXNlIDU4OnRoaXMuJCA9IFtdO1xuYnJlYWs7XG5jYXNlIDU5OiQkWyQwLTFdLnB1c2goJCRbJDBdKTtcbmJyZWFrO1xuY2FzZSA2NDp0aGlzLiQgPSBbXTtcbmJyZWFrO1xuY2FzZSA2NTokJFskMC0xXS5wdXNoKCQkWyQwXSk7XG5icmVhaztcbmNhc2UgNzA6dGhpcy4kID0gW107XG5icmVhaztcbmNhc2UgNzE6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG5jYXNlIDc4OnRoaXMuJCA9IFtdO1xuYnJlYWs7XG5jYXNlIDc5OiQkWyQwLTFdLnB1c2goJCRbJDBdKTtcbmJyZWFrO1xuY2FzZSA4Mjp0aGlzLiQgPSBbXTtcbmJyZWFrO1xuY2FzZSA4MzokJFskMC0xXS5wdXNoKCQkWyQwXSk7XG5icmVhaztcbmNhc2UgODY6dGhpcy4kID0gW107XG5icmVhaztcbmNhc2UgODc6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG5jYXNlIDkwOnRoaXMuJCA9IFtdO1xuYnJlYWs7XG5jYXNlIDkxOiQkWyQwLTFdLnB1c2goJCRbJDBdKTtcbmJyZWFrO1xuY2FzZSA5NDp0aGlzLiQgPSBbXTtcbmJyZWFrO1xuY2FzZSA5NTokJFskMC0xXS5wdXNoKCQkWyQwXSk7XG5icmVhaztcbmNhc2UgOTg6dGhpcy4kID0gWyQkWyQwXV07XG5icmVhaztcbmNhc2UgOTk6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG5jYXNlIDEwMDp0aGlzLiQgPSBbJCRbJDBdXTtcbmJyZWFrO1xuY2FzZSAxMDE6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG59XG59LFxudGFibGU6IFt7MzoxLDQ6Miw1OlsyLDQ2XSw2OjMsMTQ6WzIsNDZdLDE1OlsyLDQ2XSwxOTpbMiw0Nl0sMjk6WzIsNDZdLDM0OlsyLDQ2XSw0ODpbMiw0Nl0sNTE6WzIsNDZdLDU1OlsyLDQ2XSw2MDpbMiw0Nl19LHsxOlszXX0sezU6WzEsNF19LHs1OlsyLDJdLDc6NSw4OjYsOTo3LDEwOjgsMTE6OSwxMjoxMCwxMzoxMSwxNDpbMSwxMl0sMTU6WzEsMjBdLDE2OjE3LDE5OlsxLDIzXSwyNDoxNSwyNzoxNiwyOTpbMSwyMV0sMzQ6WzEsMjJdLDM5OlsyLDJdLDQ0OlsyLDJdLDQ3OlsyLDJdLDQ4OlsxLDEzXSw1MTpbMSwxNF0sNTU6WzEsMThdLDU5OjE5LDYwOlsxLDI0XX0sezE6WzIsMV19LHs1OlsyLDQ3XSwxNDpbMiw0N10sMTU6WzIsNDddLDE5OlsyLDQ3XSwyOTpbMiw0N10sMzQ6WzIsNDddLDM5OlsyLDQ3XSw0NDpbMiw0N10sNDc6WzIsNDddLDQ4OlsyLDQ3XSw1MTpbMiw0N10sNTU6WzIsNDddLDYwOlsyLDQ3XX0sezU6WzIsM10sMTQ6WzIsM10sMTU6WzIsM10sMTk6WzIsM10sMjk6WzIsM10sMzQ6WzIsM10sMzk6WzIsM10sNDQ6WzIsM10sNDc6WzIsM10sNDg6WzIsM10sNTE6WzIsM10sNTU6WzIsM10sNjA6WzIsM119LHs1OlsyLDRdLDE0OlsyLDRdLDE1OlsyLDRdLDE5OlsyLDRdLDI5OlsyLDRdLDM0OlsyLDRdLDM5OlsyLDRdLDQ0OlsyLDRdLDQ3OlsyLDRdLDQ4OlsyLDRdLDUxOlsyLDRdLDU1OlsyLDRdLDYwOlsyLDRdfSx7NTpbMiw1XSwxNDpbMiw1XSwxNTpbMiw1XSwxOTpbMiw1XSwyOTpbMiw1XSwzNDpbMiw1XSwzOTpbMiw1XSw0NDpbMiw1XSw0NzpbMiw1XSw0ODpbMiw1XSw1MTpbMiw1XSw1NTpbMiw1XSw2MDpbMiw1XX0sezU6WzIsNl0sMTQ6WzIsNl0sMTU6WzIsNl0sMTk6WzIsNl0sMjk6WzIsNl0sMzQ6WzIsNl0sMzk6WzIsNl0sNDQ6WzIsNl0sNDc6WzIsNl0sNDg6WzIsNl0sNTE6WzIsNl0sNTU6WzIsNl0sNjA6WzIsNl19LHs1OlsyLDddLDE0OlsyLDddLDE1OlsyLDddLDE5OlsyLDddLDI5OlsyLDddLDM0OlsyLDddLDM5OlsyLDddLDQ0OlsyLDddLDQ3OlsyLDddLDQ4OlsyLDddLDUxOlsyLDddLDU1OlsyLDddLDYwOlsyLDddfSx7NTpbMiw4XSwxNDpbMiw4XSwxNTpbMiw4XSwxOTpbMiw4XSwyOTpbMiw4XSwzNDpbMiw4XSwzOTpbMiw4XSw0NDpbMiw4XSw0NzpbMiw4XSw0ODpbMiw4XSw1MTpbMiw4XSw1NTpbMiw4XSw2MDpbMiw4XX0sezU6WzIsOV0sMTQ6WzIsOV0sMTU6WzIsOV0sMTk6WzIsOV0sMjk6WzIsOV0sMzQ6WzIsOV0sMzk6WzIsOV0sNDQ6WzIsOV0sNDc6WzIsOV0sNDg6WzIsOV0sNTE6WzIsOV0sNTU6WzIsOV0sNjA6WzIsOV19LHsyMDoyNSw3MjpbMSwzNV0sNzg6MjYsNzk6MjcsODA6WzEsMjhdLDgxOlsxLDI5XSw4MjpbMSwzMF0sODM6WzEsMzFdLDg0OlsxLDMyXSw4NTpbMSwzNF0sODY6MzN9LHsyMDozNiw3MjpbMSwzNV0sNzg6MjYsNzk6MjcsODA6WzEsMjhdLDgxOlsxLDI5XSw4MjpbMSwzMF0sODM6WzEsMzFdLDg0OlsxLDMyXSw4NTpbMSwzNF0sODY6MzN9LHs0OjM3LDY6MywxNDpbMiw0Nl0sMTU6WzIsNDZdLDE5OlsyLDQ2XSwyOTpbMiw0Nl0sMzQ6WzIsNDZdLDM5OlsyLDQ2XSw0NDpbMiw0Nl0sNDc6WzIsNDZdLDQ4OlsyLDQ2XSw1MTpbMiw0Nl0sNTU6WzIsNDZdLDYwOlsyLDQ2XX0sezQ6MzgsNjozLDE0OlsyLDQ2XSwxNTpbMiw0Nl0sMTk6WzIsNDZdLDI5OlsyLDQ2XSwzNDpbMiw0Nl0sNDQ6WzIsNDZdLDQ3OlsyLDQ2XSw0ODpbMiw0Nl0sNTE6WzIsNDZdLDU1OlsyLDQ2XSw2MDpbMiw0Nl19LHsxMzo0MCwxNTpbMSwyMF0sMTc6Mzl9LHsyMDo0Miw1Njo0MSw2NDo0Myw2NTpbMSw0NF0sNzI6WzEsMzVdLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7NDo0NSw2OjMsMTQ6WzIsNDZdLDE1OlsyLDQ2XSwxOTpbMiw0Nl0sMjk6WzIsNDZdLDM0OlsyLDQ2XSw0NzpbMiw0Nl0sNDg6WzIsNDZdLDUxOlsyLDQ2XSw1NTpbMiw0Nl0sNjA6WzIsNDZdfSx7NTpbMiwxMF0sMTQ6WzIsMTBdLDE1OlsyLDEwXSwxODpbMiwxMF0sMTk6WzIsMTBdLDI5OlsyLDEwXSwzNDpbMiwxMF0sMzk6WzIsMTBdLDQ0OlsyLDEwXSw0NzpbMiwxMF0sNDg6WzIsMTBdLDUxOlsyLDEwXSw1NTpbMiwxMF0sNjA6WzIsMTBdfSx7MjA6NDYsNzI6WzEsMzVdLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7MjA6NDcsNzI6WzEsMzVdLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7MjA6NDgsNzI6WzEsMzVdLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7MjA6NDIsNTY6NDksNjQ6NDMsNjU6WzEsNDRdLDcyOlsxLDM1XSw3ODoyNiw3OToyNyw4MDpbMSwyOF0sODE6WzEsMjldLDgyOlsxLDMwXSw4MzpbMSwzMV0sODQ6WzEsMzJdLDg1OlsxLDM0XSw4NjozM30sezMzOlsyLDc4XSw0OTo1MCw2NTpbMiw3OF0sNzI6WzIsNzhdLDgwOlsyLDc4XSw4MTpbMiw3OF0sODI6WzIsNzhdLDgzOlsyLDc4XSw4NDpbMiw3OF0sODU6WzIsNzhdfSx7MjM6WzIsMzNdLDMzOlsyLDMzXSw1NDpbMiwzM10sNjU6WzIsMzNdLDY4OlsyLDMzXSw3MjpbMiwzM10sNzU6WzIsMzNdLDgwOlsyLDMzXSw4MTpbMiwzM10sODI6WzIsMzNdLDgzOlsyLDMzXSw4NDpbMiwzM10sODU6WzIsMzNdfSx7MjM6WzIsMzRdLDMzOlsyLDM0XSw1NDpbMiwzNF0sNjU6WzIsMzRdLDY4OlsyLDM0XSw3MjpbMiwzNF0sNzU6WzIsMzRdLDgwOlsyLDM0XSw4MTpbMiwzNF0sODI6WzIsMzRdLDgzOlsyLDM0XSw4NDpbMiwzNF0sODU6WzIsMzRdfSx7MjM6WzIsMzVdLDMzOlsyLDM1XSw1NDpbMiwzNV0sNjU6WzIsMzVdLDY4OlsyLDM1XSw3MjpbMiwzNV0sNzU6WzIsMzVdLDgwOlsyLDM1XSw4MTpbMiwzNV0sODI6WzIsMzVdLDgzOlsyLDM1XSw4NDpbMiwzNV0sODU6WzIsMzVdfSx7MjM6WzIsMzZdLDMzOlsyLDM2XSw1NDpbMiwzNl0sNjU6WzIsMzZdLDY4OlsyLDM2XSw3MjpbMiwzNl0sNzU6WzIsMzZdLDgwOlsyLDM2XSw4MTpbMiwzNl0sODI6WzIsMzZdLDgzOlsyLDM2XSw4NDpbMiwzNl0sODU6WzIsMzZdfSx7MjM6WzIsMzddLDMzOlsyLDM3XSw1NDpbMiwzN10sNjU6WzIsMzddLDY4OlsyLDM3XSw3MjpbMiwzN10sNzU6WzIsMzddLDgwOlsyLDM3XSw4MTpbMiwzN10sODI6WzIsMzddLDgzOlsyLDM3XSw4NDpbMiwzN10sODU6WzIsMzddfSx7MjM6WzIsMzhdLDMzOlsyLDM4XSw1NDpbMiwzOF0sNjU6WzIsMzhdLDY4OlsyLDM4XSw3MjpbMiwzOF0sNzU6WzIsMzhdLDgwOlsyLDM4XSw4MTpbMiwzOF0sODI6WzIsMzhdLDgzOlsyLDM4XSw4NDpbMiwzOF0sODU6WzIsMzhdfSx7MjM6WzIsMzldLDMzOlsyLDM5XSw1NDpbMiwzOV0sNjU6WzIsMzldLDY4OlsyLDM5XSw3MjpbMiwzOV0sNzU6WzIsMzldLDgwOlsyLDM5XSw4MTpbMiwzOV0sODI6WzIsMzldLDgzOlsyLDM5XSw4NDpbMiwzOV0sODU6WzIsMzldfSx7MjM6WzIsNDNdLDMzOlsyLDQzXSw1NDpbMiw0M10sNjU6WzIsNDNdLDY4OlsyLDQzXSw3MjpbMiw0M10sNzU6WzIsNDNdLDgwOlsyLDQzXSw4MTpbMiw0M10sODI6WzIsNDNdLDgzOlsyLDQzXSw4NDpbMiw0M10sODU6WzIsNDNdLDg3OlsxLDUxXX0sezcyOlsxLDM1XSw4Njo1Mn0sezIzOlsyLDQ1XSwzMzpbMiw0NV0sNTQ6WzIsNDVdLDY1OlsyLDQ1XSw2ODpbMiw0NV0sNzI6WzIsNDVdLDc1OlsyLDQ1XSw4MDpbMiw0NV0sODE6WzIsNDVdLDgyOlsyLDQ1XSw4MzpbMiw0NV0sODQ6WzIsNDVdLDg1OlsyLDQ1XSw4NzpbMiw0NV19LHs1Mjo1Myw1NDpbMiw4Ml0sNjU6WzIsODJdLDcyOlsyLDgyXSw4MDpbMiw4Ml0sODE6WzIsODJdLDgyOlsyLDgyXSw4MzpbMiw4Ml0sODQ6WzIsODJdLDg1OlsyLDgyXX0sezI1OjU0LDM4OjU2LDM5OlsxLDU4XSw0Mzo1Nyw0NDpbMSw1OV0sNDU6NTUsNDc6WzIsNTRdfSx7Mjg6NjAsNDM6NjEsNDQ6WzEsNTldLDQ3OlsyLDU2XX0sezEzOjYzLDE1OlsxLDIwXSwxODpbMSw2Ml19LHsxNTpbMiw0OF0sMTg6WzIsNDhdfSx7MzM6WzIsODZdLDU3OjY0LDY1OlsyLDg2XSw3MjpbMiw4Nl0sODA6WzIsODZdLDgxOlsyLDg2XSw4MjpbMiw4Nl0sODM6WzIsODZdLDg0OlsyLDg2XSw4NTpbMiw4Nl19LHszMzpbMiw0MF0sNjU6WzIsNDBdLDcyOlsyLDQwXSw4MDpbMiw0MF0sODE6WzIsNDBdLDgyOlsyLDQwXSw4MzpbMiw0MF0sODQ6WzIsNDBdLDg1OlsyLDQwXX0sezMzOlsyLDQxXSw2NTpbMiw0MV0sNzI6WzIsNDFdLDgwOlsyLDQxXSw4MTpbMiw0MV0sODI6WzIsNDFdLDgzOlsyLDQxXSw4NDpbMiw0MV0sODU6WzIsNDFdfSx7MjA6NjUsNzI6WzEsMzVdLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7MjY6NjYsNDc6WzEsNjddfSx7MzA6NjgsMzM6WzIsNThdLDY1OlsyLDU4XSw3MjpbMiw1OF0sNzU6WzIsNThdLDgwOlsyLDU4XSw4MTpbMiw1OF0sODI6WzIsNThdLDgzOlsyLDU4XSw4NDpbMiw1OF0sODU6WzIsNThdfSx7MzM6WzIsNjRdLDM1OjY5LDY1OlsyLDY0XSw3MjpbMiw2NF0sNzU6WzIsNjRdLDgwOlsyLDY0XSw4MTpbMiw2NF0sODI6WzIsNjRdLDgzOlsyLDY0XSw4NDpbMiw2NF0sODU6WzIsNjRdfSx7MjE6NzAsMjM6WzIsNTBdLDY1OlsyLDUwXSw3MjpbMiw1MF0sODA6WzIsNTBdLDgxOlsyLDUwXSw4MjpbMiw1MF0sODM6WzIsNTBdLDg0OlsyLDUwXSw4NTpbMiw1MF19LHszMzpbMiw5MF0sNjE6NzEsNjU6WzIsOTBdLDcyOlsyLDkwXSw4MDpbMiw5MF0sODE6WzIsOTBdLDgyOlsyLDkwXSw4MzpbMiw5MF0sODQ6WzIsOTBdLDg1OlsyLDkwXX0sezIwOjc1LDMzOlsyLDgwXSw1MDo3Miw2Mzo3Myw2NDo3Niw2NTpbMSw0NF0sNjk6NzQsNzA6NzcsNzE6NzgsNzI6WzEsNzldLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7NzI6WzEsODBdfSx7MjM6WzIsNDJdLDMzOlsyLDQyXSw1NDpbMiw0Ml0sNjU6WzIsNDJdLDY4OlsyLDQyXSw3MjpbMiw0Ml0sNzU6WzIsNDJdLDgwOlsyLDQyXSw4MTpbMiw0Ml0sODI6WzIsNDJdLDgzOlsyLDQyXSw4NDpbMiw0Ml0sODU6WzIsNDJdLDg3OlsxLDUxXX0sezIwOjc1LDUzOjgxLDU0OlsyLDg0XSw2Mzo4Miw2NDo3Niw2NTpbMSw0NF0sNjk6ODMsNzA6NzcsNzE6NzgsNzI6WzEsNzldLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7MjY6ODQsNDc6WzEsNjddfSx7NDc6WzIsNTVdfSx7NDo4NSw2OjMsMTQ6WzIsNDZdLDE1OlsyLDQ2XSwxOTpbMiw0Nl0sMjk6WzIsNDZdLDM0OlsyLDQ2XSwzOTpbMiw0Nl0sNDQ6WzIsNDZdLDQ3OlsyLDQ2XSw0ODpbMiw0Nl0sNTE6WzIsNDZdLDU1OlsyLDQ2XSw2MDpbMiw0Nl19LHs0NzpbMiwyMF19LHsyMDo4Niw3MjpbMSwzNV0sNzg6MjYsNzk6MjcsODA6WzEsMjhdLDgxOlsxLDI5XSw4MjpbMSwzMF0sODM6WzEsMzFdLDg0OlsxLDMyXSw4NTpbMSwzNF0sODY6MzN9LHs0Ojg3LDY6MywxNDpbMiw0Nl0sMTU6WzIsNDZdLDE5OlsyLDQ2XSwyOTpbMiw0Nl0sMzQ6WzIsNDZdLDQ3OlsyLDQ2XSw0ODpbMiw0Nl0sNTE6WzIsNDZdLDU1OlsyLDQ2XSw2MDpbMiw0Nl19LHsyNjo4OCw0NzpbMSw2N119LHs0NzpbMiw1N119LHs1OlsyLDExXSwxNDpbMiwxMV0sMTU6WzIsMTFdLDE5OlsyLDExXSwyOTpbMiwxMV0sMzQ6WzIsMTFdLDM5OlsyLDExXSw0NDpbMiwxMV0sNDc6WzIsMTFdLDQ4OlsyLDExXSw1MTpbMiwxMV0sNTU6WzIsMTFdLDYwOlsyLDExXX0sezE1OlsyLDQ5XSwxODpbMiw0OV19LHsyMDo3NSwzMzpbMiw4OF0sNTg6ODksNjM6OTAsNjQ6NzYsNjU6WzEsNDRdLDY5OjkxLDcwOjc3LDcxOjc4LDcyOlsxLDc5XSw3ODoyNiw3OToyNyw4MDpbMSwyOF0sODE6WzEsMjldLDgyOlsxLDMwXSw4MzpbMSwzMV0sODQ6WzEsMzJdLDg1OlsxLDM0XSw4NjozM30sezY1OlsyLDk0XSw2Njo5Miw2ODpbMiw5NF0sNzI6WzIsOTRdLDgwOlsyLDk0XSw4MTpbMiw5NF0sODI6WzIsOTRdLDgzOlsyLDk0XSw4NDpbMiw5NF0sODU6WzIsOTRdfSx7NTpbMiwyNV0sMTQ6WzIsMjVdLDE1OlsyLDI1XSwxOTpbMiwyNV0sMjk6WzIsMjVdLDM0OlsyLDI1XSwzOTpbMiwyNV0sNDQ6WzIsMjVdLDQ3OlsyLDI1XSw0ODpbMiwyNV0sNTE6WzIsMjVdLDU1OlsyLDI1XSw2MDpbMiwyNV19LHsyMDo5Myw3MjpbMSwzNV0sNzg6MjYsNzk6MjcsODA6WzEsMjhdLDgxOlsxLDI5XSw4MjpbMSwzMF0sODM6WzEsMzFdLDg0OlsxLDMyXSw4NTpbMSwzNF0sODY6MzN9LHsyMDo3NSwzMTo5NCwzMzpbMiw2MF0sNjM6OTUsNjQ6NzYsNjU6WzEsNDRdLDY5Ojk2LDcwOjc3LDcxOjc4LDcyOlsxLDc5XSw3NTpbMiw2MF0sNzg6MjYsNzk6MjcsODA6WzEsMjhdLDgxOlsxLDI5XSw4MjpbMSwzMF0sODM6WzEsMzFdLDg0OlsxLDMyXSw4NTpbMSwzNF0sODY6MzN9LHsyMDo3NSwzMzpbMiw2Nl0sMzY6OTcsNjM6OTgsNjQ6NzYsNjU6WzEsNDRdLDY5Ojk5LDcwOjc3LDcxOjc4LDcyOlsxLDc5XSw3NTpbMiw2Nl0sNzg6MjYsNzk6MjcsODA6WzEsMjhdLDgxOlsxLDI5XSw4MjpbMSwzMF0sODM6WzEsMzFdLDg0OlsxLDMyXSw4NTpbMSwzNF0sODY6MzN9LHsyMDo3NSwyMjoxMDAsMjM6WzIsNTJdLDYzOjEwMSw2NDo3Niw2NTpbMSw0NF0sNjk6MTAyLDcwOjc3LDcxOjc4LDcyOlsxLDc5XSw3ODoyNiw3OToyNyw4MDpbMSwyOF0sODE6WzEsMjldLDgyOlsxLDMwXSw4MzpbMSwzMV0sODQ6WzEsMzJdLDg1OlsxLDM0XSw4NjozM30sezIwOjc1LDMzOlsyLDkyXSw2MjoxMDMsNjM6MTA0LDY0Ojc2LDY1OlsxLDQ0XSw2OToxMDUsNzA6NzcsNzE6NzgsNzI6WzEsNzldLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7MzM6WzEsMTA2XX0sezMzOlsyLDc5XSw2NTpbMiw3OV0sNzI6WzIsNzldLDgwOlsyLDc5XSw4MTpbMiw3OV0sODI6WzIsNzldLDgzOlsyLDc5XSw4NDpbMiw3OV0sODU6WzIsNzldfSx7MzM6WzIsODFdfSx7MjM6WzIsMjddLDMzOlsyLDI3XSw1NDpbMiwyN10sNjU6WzIsMjddLDY4OlsyLDI3XSw3MjpbMiwyN10sNzU6WzIsMjddLDgwOlsyLDI3XSw4MTpbMiwyN10sODI6WzIsMjddLDgzOlsyLDI3XSw4NDpbMiwyN10sODU6WzIsMjddfSx7MjM6WzIsMjhdLDMzOlsyLDI4XSw1NDpbMiwyOF0sNjU6WzIsMjhdLDY4OlsyLDI4XSw3MjpbMiwyOF0sNzU6WzIsMjhdLDgwOlsyLDI4XSw4MTpbMiwyOF0sODI6WzIsMjhdLDgzOlsyLDI4XSw4NDpbMiwyOF0sODU6WzIsMjhdfSx7MjM6WzIsMzBdLDMzOlsyLDMwXSw1NDpbMiwzMF0sNjg6WzIsMzBdLDcxOjEwNyw3MjpbMSwxMDhdLDc1OlsyLDMwXX0sezIzOlsyLDk4XSwzMzpbMiw5OF0sNTQ6WzIsOThdLDY4OlsyLDk4XSw3MjpbMiw5OF0sNzU6WzIsOThdfSx7MjM6WzIsNDVdLDMzOlsyLDQ1XSw1NDpbMiw0NV0sNjU6WzIsNDVdLDY4OlsyLDQ1XSw3MjpbMiw0NV0sNzM6WzEsMTA5XSw3NTpbMiw0NV0sODA6WzIsNDVdLDgxOlsyLDQ1XSw4MjpbMiw0NV0sODM6WzIsNDVdLDg0OlsyLDQ1XSw4NTpbMiw0NV0sODc6WzIsNDVdfSx7MjM6WzIsNDRdLDMzOlsyLDQ0XSw1NDpbMiw0NF0sNjU6WzIsNDRdLDY4OlsyLDQ0XSw3MjpbMiw0NF0sNzU6WzIsNDRdLDgwOlsyLDQ0XSw4MTpbMiw0NF0sODI6WzIsNDRdLDgzOlsyLDQ0XSw4NDpbMiw0NF0sODU6WzIsNDRdLDg3OlsyLDQ0XX0sezU0OlsxLDExMF19LHs1NDpbMiw4M10sNjU6WzIsODNdLDcyOlsyLDgzXSw4MDpbMiw4M10sODE6WzIsODNdLDgyOlsyLDgzXSw4MzpbMiw4M10sODQ6WzIsODNdLDg1OlsyLDgzXX0sezU0OlsyLDg1XX0sezU6WzIsMTNdLDE0OlsyLDEzXSwxNTpbMiwxM10sMTk6WzIsMTNdLDI5OlsyLDEzXSwzNDpbMiwxM10sMzk6WzIsMTNdLDQ0OlsyLDEzXSw0NzpbMiwxM10sNDg6WzIsMTNdLDUxOlsyLDEzXSw1NTpbMiwxM10sNjA6WzIsMTNdfSx7Mzg6NTYsMzk6WzEsNThdLDQzOjU3LDQ0OlsxLDU5XSw0NToxMTIsNDY6MTExLDQ3OlsyLDc2XX0sezMzOlsyLDcwXSw0MDoxMTMsNjU6WzIsNzBdLDcyOlsyLDcwXSw3NTpbMiw3MF0sODA6WzIsNzBdLDgxOlsyLDcwXSw4MjpbMiw3MF0sODM6WzIsNzBdLDg0OlsyLDcwXSw4NTpbMiw3MF19LHs0NzpbMiwxOF19LHs1OlsyLDE0XSwxNDpbMiwxNF0sMTU6WzIsMTRdLDE5OlsyLDE0XSwyOTpbMiwxNF0sMzQ6WzIsMTRdLDM5OlsyLDE0XSw0NDpbMiwxNF0sNDc6WzIsMTRdLDQ4OlsyLDE0XSw1MTpbMiwxNF0sNTU6WzIsMTRdLDYwOlsyLDE0XX0sezMzOlsxLDExNF19LHszMzpbMiw4N10sNjU6WzIsODddLDcyOlsyLDg3XSw4MDpbMiw4N10sODE6WzIsODddLDgyOlsyLDg3XSw4MzpbMiw4N10sODQ6WzIsODddLDg1OlsyLDg3XX0sezMzOlsyLDg5XX0sezIwOjc1LDYzOjExNiw2NDo3Niw2NTpbMSw0NF0sNjc6MTE1LDY4OlsyLDk2XSw2OToxMTcsNzA6NzcsNzE6NzgsNzI6WzEsNzldLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7MzM6WzEsMTE4XX0sezMyOjExOSwzMzpbMiw2Ml0sNzQ6MTIwLDc1OlsxLDEyMV19LHszMzpbMiw1OV0sNjU6WzIsNTldLDcyOlsyLDU5XSw3NTpbMiw1OV0sODA6WzIsNTldLDgxOlsyLDU5XSw4MjpbMiw1OV0sODM6WzIsNTldLDg0OlsyLDU5XSw4NTpbMiw1OV19LHszMzpbMiw2MV0sNzU6WzIsNjFdfSx7MzM6WzIsNjhdLDM3OjEyMiw3NDoxMjMsNzU6WzEsMTIxXX0sezMzOlsyLDY1XSw2NTpbMiw2NV0sNzI6WzIsNjVdLDc1OlsyLDY1XSw4MDpbMiw2NV0sODE6WzIsNjVdLDgyOlsyLDY1XSw4MzpbMiw2NV0sODQ6WzIsNjVdLDg1OlsyLDY1XX0sezMzOlsyLDY3XSw3NTpbMiw2N119LHsyMzpbMSwxMjRdfSx7MjM6WzIsNTFdLDY1OlsyLDUxXSw3MjpbMiw1MV0sODA6WzIsNTFdLDgxOlsyLDUxXSw4MjpbMiw1MV0sODM6WzIsNTFdLDg0OlsyLDUxXSw4NTpbMiw1MV19LHsyMzpbMiw1M119LHszMzpbMSwxMjVdfSx7MzM6WzIsOTFdLDY1OlsyLDkxXSw3MjpbMiw5MV0sODA6WzIsOTFdLDgxOlsyLDkxXSw4MjpbMiw5MV0sODM6WzIsOTFdLDg0OlsyLDkxXSw4NTpbMiw5MV19LHszMzpbMiw5M119LHs1OlsyLDIyXSwxNDpbMiwyMl0sMTU6WzIsMjJdLDE5OlsyLDIyXSwyOTpbMiwyMl0sMzQ6WzIsMjJdLDM5OlsyLDIyXSw0NDpbMiwyMl0sNDc6WzIsMjJdLDQ4OlsyLDIyXSw1MTpbMiwyMl0sNTU6WzIsMjJdLDYwOlsyLDIyXX0sezIzOlsyLDk5XSwzMzpbMiw5OV0sNTQ6WzIsOTldLDY4OlsyLDk5XSw3MjpbMiw5OV0sNzU6WzIsOTldfSx7NzM6WzEsMTA5XX0sezIwOjc1LDYzOjEyNiw2NDo3Niw2NTpbMSw0NF0sNzI6WzEsMzVdLDc4OjI2LDc5OjI3LDgwOlsxLDI4XSw4MTpbMSwyOV0sODI6WzEsMzBdLDgzOlsxLDMxXSw4NDpbMSwzMl0sODU6WzEsMzRdLDg2OjMzfSx7NTpbMiwyM10sMTQ6WzIsMjNdLDE1OlsyLDIzXSwxOTpbMiwyM10sMjk6WzIsMjNdLDM0OlsyLDIzXSwzOTpbMiwyM10sNDQ6WzIsMjNdLDQ3OlsyLDIzXSw0ODpbMiwyM10sNTE6WzIsMjNdLDU1OlsyLDIzXSw2MDpbMiwyM119LHs0NzpbMiwxOV19LHs0NzpbMiw3N119LHsyMDo3NSwzMzpbMiw3Ml0sNDE6MTI3LDYzOjEyOCw2NDo3Niw2NTpbMSw0NF0sNjk6MTI5LDcwOjc3LDcxOjc4LDcyOlsxLDc5XSw3NTpbMiw3Ml0sNzg6MjYsNzk6MjcsODA6WzEsMjhdLDgxOlsxLDI5XSw4MjpbMSwzMF0sODM6WzEsMzFdLDg0OlsxLDMyXSw4NTpbMSwzNF0sODY6MzN9LHs1OlsyLDI0XSwxNDpbMiwyNF0sMTU6WzIsMjRdLDE5OlsyLDI0XSwyOTpbMiwyNF0sMzQ6WzIsMjRdLDM5OlsyLDI0XSw0NDpbMiwyNF0sNDc6WzIsMjRdLDQ4OlsyLDI0XSw1MTpbMiwyNF0sNTU6WzIsMjRdLDYwOlsyLDI0XX0sezY4OlsxLDEzMF19LHs2NTpbMiw5NV0sNjg6WzIsOTVdLDcyOlsyLDk1XSw4MDpbMiw5NV0sODE6WzIsOTVdLDgyOlsyLDk1XSw4MzpbMiw5NV0sODQ6WzIsOTVdLDg1OlsyLDk1XX0sezY4OlsyLDk3XX0sezU6WzIsMjFdLDE0OlsyLDIxXSwxNTpbMiwyMV0sMTk6WzIsMjFdLDI5OlsyLDIxXSwzNDpbMiwyMV0sMzk6WzIsMjFdLDQ0OlsyLDIxXSw0NzpbMiwyMV0sNDg6WzIsMjFdLDUxOlsyLDIxXSw1NTpbMiwyMV0sNjA6WzIsMjFdfSx7MzM6WzEsMTMxXX0sezMzOlsyLDYzXX0sezcyOlsxLDEzM10sNzY6MTMyfSx7MzM6WzEsMTM0XX0sezMzOlsyLDY5XX0sezE1OlsyLDEyXX0sezE0OlsyLDI2XSwxNTpbMiwyNl0sMTk6WzIsMjZdLDI5OlsyLDI2XSwzNDpbMiwyNl0sNDc6WzIsMjZdLDQ4OlsyLDI2XSw1MTpbMiwyNl0sNTU6WzIsMjZdLDYwOlsyLDI2XX0sezIzOlsyLDMxXSwzMzpbMiwzMV0sNTQ6WzIsMzFdLDY4OlsyLDMxXSw3MjpbMiwzMV0sNzU6WzIsMzFdfSx7MzM6WzIsNzRdLDQyOjEzNSw3NDoxMzYsNzU6WzEsMTIxXX0sezMzOlsyLDcxXSw2NTpbMiw3MV0sNzI6WzIsNzFdLDc1OlsyLDcxXSw4MDpbMiw3MV0sODE6WzIsNzFdLDgyOlsyLDcxXSw4MzpbMiw3MV0sODQ6WzIsNzFdLDg1OlsyLDcxXX0sezMzOlsyLDczXSw3NTpbMiw3M119LHsyMzpbMiwyOV0sMzM6WzIsMjldLDU0OlsyLDI5XSw2NTpbMiwyOV0sNjg6WzIsMjldLDcyOlsyLDI5XSw3NTpbMiwyOV0sODA6WzIsMjldLDgxOlsyLDI5XSw4MjpbMiwyOV0sODM6WzIsMjldLDg0OlsyLDI5XSw4NTpbMiwyOV19LHsxNDpbMiwxNV0sMTU6WzIsMTVdLDE5OlsyLDE1XSwyOTpbMiwxNV0sMzQ6WzIsMTVdLDM5OlsyLDE1XSw0NDpbMiwxNV0sNDc6WzIsMTVdLDQ4OlsyLDE1XSw1MTpbMiwxNV0sNTU6WzIsMTVdLDYwOlsyLDE1XX0sezcyOlsxLDEzOF0sNzc6WzEsMTM3XX0sezcyOlsyLDEwMF0sNzc6WzIsMTAwXX0sezE0OlsyLDE2XSwxNTpbMiwxNl0sMTk6WzIsMTZdLDI5OlsyLDE2XSwzNDpbMiwxNl0sNDQ6WzIsMTZdLDQ3OlsyLDE2XSw0ODpbMiwxNl0sNTE6WzIsMTZdLDU1OlsyLDE2XSw2MDpbMiwxNl19LHszMzpbMSwxMzldfSx7MzM6WzIsNzVdfSx7MzM6WzIsMzJdfSx7NzI6WzIsMTAxXSw3NzpbMiwxMDFdfSx7MTQ6WzIsMTddLDE1OlsyLDE3XSwxOTpbMiwxN10sMjk6WzIsMTddLDM0OlsyLDE3XSwzOTpbMiwxN10sNDQ6WzIsMTddLDQ3OlsyLDE3XSw0ODpbMiwxN10sNTE6WzIsMTddLDU1OlsyLDE3XSw2MDpbMiwxN119XSxcbmRlZmF1bHRBY3Rpb25zOiB7NDpbMiwxXSw1NTpbMiw1NV0sNTc6WzIsMjBdLDYxOlsyLDU3XSw3NDpbMiw4MV0sODM6WzIsODVdLDg3OlsyLDE4XSw5MTpbMiw4OV0sMTAyOlsyLDUzXSwxMDU6WzIsOTNdLDExMTpbMiwxOV0sMTEyOlsyLDc3XSwxMTc6WzIsOTddLDEyMDpbMiw2M10sMTIzOlsyLDY5XSwxMjQ6WzIsMTJdLDEzNjpbMiw3NV0sMTM3OlsyLDMyXX0sXG5wYXJzZUVycm9yOiBmdW5jdGlvbiBwYXJzZUVycm9yKHN0ciwgaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihzdHIpO1xufSxcbnBhcnNlOiBmdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAgIHZhciBzZWxmID0gdGhpcywgc3RhY2sgPSBbMF0sIHZzdGFjayA9IFtudWxsXSwgbHN0YWNrID0gW10sIHRhYmxlID0gdGhpcy50YWJsZSwgeXl0ZXh0ID0gXCJcIiwgeXlsaW5lbm8gPSAwLCB5eWxlbmcgPSAwLCByZWNvdmVyaW5nID0gMCwgVEVSUk9SID0gMiwgRU9GID0gMTtcbiAgICB0aGlzLmxleGVyLnNldElucHV0KGlucHV0KTtcbiAgICB0aGlzLmxleGVyLnl5ID0gdGhpcy55eTtcbiAgICB0aGlzLnl5LmxleGVyID0gdGhpcy5sZXhlcjtcbiAgICB0aGlzLnl5LnBhcnNlciA9IHRoaXM7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmxleGVyLnl5bGxvYyA9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICB0aGlzLmxleGVyLnl5bGxvYyA9IHt9O1xuICAgIHZhciB5eWxvYyA9IHRoaXMubGV4ZXIueXlsbG9jO1xuICAgIGxzdGFjay5wdXNoKHl5bG9jKTtcbiAgICB2YXIgcmFuZ2VzID0gdGhpcy5sZXhlci5vcHRpb25zICYmIHRoaXMubGV4ZXIub3B0aW9ucy5yYW5nZXM7XG4gICAgaWYgKHR5cGVvZiB0aGlzLnl5LnBhcnNlRXJyb3IgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgdGhpcy5wYXJzZUVycm9yID0gdGhpcy55eS5wYXJzZUVycm9yO1xuICAgIGZ1bmN0aW9uIHBvcFN0YWNrKG4pIHtcbiAgICAgICAgc3RhY2subGVuZ3RoID0gc3RhY2subGVuZ3RoIC0gMiAqIG47XG4gICAgICAgIHZzdGFjay5sZW5ndGggPSB2c3RhY2subGVuZ3RoIC0gbjtcbiAgICAgICAgbHN0YWNrLmxlbmd0aCA9IGxzdGFjay5sZW5ndGggLSBuO1xuICAgIH1cbiAgICBmdW5jdGlvbiBsZXgoKSB7XG4gICAgICAgIHZhciB0b2tlbjtcbiAgICAgICAgdG9rZW4gPSBzZWxmLmxleGVyLmxleCgpIHx8IDE7XG4gICAgICAgIGlmICh0eXBlb2YgdG9rZW4gIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgIHRva2VuID0gc2VsZi5zeW1ib2xzX1t0b2tlbl0gfHwgdG9rZW47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH1cbiAgICB2YXIgc3ltYm9sLCBwcmVFcnJvclN5bWJvbCwgc3RhdGUsIGFjdGlvbiwgYSwgciwgeXl2YWwgPSB7fSwgcCwgbGVuLCBuZXdTdGF0ZSwgZXhwZWN0ZWQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgc3RhdGUgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHRoaXMuZGVmYXVsdEFjdGlvbnNbc3RhdGVdKSB7XG4gICAgICAgICAgICBhY3Rpb24gPSB0aGlzLmRlZmF1bHRBY3Rpb25zW3N0YXRlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChzeW1ib2wgPT09IG51bGwgfHwgdHlwZW9mIHN5bWJvbCA9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgc3ltYm9sID0gbGV4KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhY3Rpb24gPSB0YWJsZVtzdGF0ZV0gJiYgdGFibGVbc3RhdGVdW3N5bWJvbF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBhY3Rpb24gPT09IFwidW5kZWZpbmVkXCIgfHwgIWFjdGlvbi5sZW5ndGggfHwgIWFjdGlvblswXSkge1xuICAgICAgICAgICAgdmFyIGVyclN0ciA9IFwiXCI7XG4gICAgICAgICAgICBpZiAoIXJlY292ZXJpbmcpIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAocCBpbiB0YWJsZVtzdGF0ZV0pXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnRlcm1pbmFsc19bcF0gJiYgcCA+IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkLnB1c2goXCInXCIgKyB0aGlzLnRlcm1pbmFsc19bcF0gKyBcIidcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sZXhlci5zaG93UG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyU3RyID0gXCJQYXJzZSBlcnJvciBvbiBsaW5lIFwiICsgKHl5bGluZW5vICsgMSkgKyBcIjpcXG5cIiArIHRoaXMubGV4ZXIuc2hvd1Bvc2l0aW9uKCkgKyBcIlxcbkV4cGVjdGluZyBcIiArIGV4cGVjdGVkLmpvaW4oXCIsIFwiKSArIFwiLCBnb3QgJ1wiICsgKHRoaXMudGVybWluYWxzX1tzeW1ib2xdIHx8IHN5bWJvbCkgKyBcIidcIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlcnJTdHIgPSBcIlBhcnNlIGVycm9yIG9uIGxpbmUgXCIgKyAoeXlsaW5lbm8gKyAxKSArIFwiOiBVbmV4cGVjdGVkIFwiICsgKHN5bWJvbCA9PSAxP1wiZW5kIG9mIGlucHV0XCI6XCInXCIgKyAodGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sKSArIFwiJ1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZUVycm9yKGVyclN0ciwge3RleHQ6IHRoaXMubGV4ZXIubWF0Y2gsIHRva2VuOiB0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wsIGxpbmU6IHRoaXMubGV4ZXIueXlsaW5lbm8sIGxvYzogeXlsb2MsIGV4cGVjdGVkOiBleHBlY3RlZH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChhY3Rpb25bMF0gaW5zdGFuY2VvZiBBcnJheSAmJiBhY3Rpb24ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGFyc2UgRXJyb3I6IG11bHRpcGxlIGFjdGlvbnMgcG9zc2libGUgYXQgc3RhdGU6IFwiICsgc3RhdGUgKyBcIiwgdG9rZW46IFwiICsgc3ltYm9sKTtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKGFjdGlvblswXSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICBzdGFjay5wdXNoKHN5bWJvbCk7XG4gICAgICAgICAgICB2c3RhY2sucHVzaCh0aGlzLmxleGVyLnl5dGV4dCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaCh0aGlzLmxleGVyLnl5bGxvYyk7XG4gICAgICAgICAgICBzdGFjay5wdXNoKGFjdGlvblsxXSk7XG4gICAgICAgICAgICBzeW1ib2wgPSBudWxsO1xuICAgICAgICAgICAgaWYgKCFwcmVFcnJvclN5bWJvbCkge1xuICAgICAgICAgICAgICAgIHl5bGVuZyA9IHRoaXMubGV4ZXIueXlsZW5nO1xuICAgICAgICAgICAgICAgIHl5dGV4dCA9IHRoaXMubGV4ZXIueXl0ZXh0O1xuICAgICAgICAgICAgICAgIHl5bGluZW5vID0gdGhpcy5sZXhlci55eWxpbmVubztcbiAgICAgICAgICAgICAgICB5eWxvYyA9IHRoaXMubGV4ZXIueXlsbG9jO1xuICAgICAgICAgICAgICAgIGlmIChyZWNvdmVyaW5nID4gMClcbiAgICAgICAgICAgICAgICAgICAgcmVjb3ZlcmluZy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzeW1ib2wgPSBwcmVFcnJvclN5bWJvbDtcbiAgICAgICAgICAgICAgICBwcmVFcnJvclN5bWJvbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgbGVuID0gdGhpcy5wcm9kdWN0aW9uc19bYWN0aW9uWzFdXVsxXTtcbiAgICAgICAgICAgIHl5dmFsLiQgPSB2c3RhY2tbdnN0YWNrLmxlbmd0aCAtIGxlbl07XG4gICAgICAgICAgICB5eXZhbC5fJCA9IHtmaXJzdF9saW5lOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIChsZW4gfHwgMSldLmZpcnN0X2xpbmUsIGxhc3RfbGluZTogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAxXS5sYXN0X2xpbmUsIGZpcnN0X2NvbHVtbjogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5maXJzdF9jb2x1bW4sIGxhc3RfY29sdW1uOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIDFdLmxhc3RfY29sdW1ufTtcbiAgICAgICAgICAgIGlmIChyYW5nZXMpIHtcbiAgICAgICAgICAgICAgICB5eXZhbC5fJC5yYW5nZSA9IFtsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIChsZW4gfHwgMSldLnJhbmdlWzBdLCBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIDFdLnJhbmdlWzFdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHIgPSB0aGlzLnBlcmZvcm1BY3Rpb24uY2FsbCh5eXZhbCwgeXl0ZXh0LCB5eWxlbmcsIHl5bGluZW5vLCB0aGlzLnl5LCBhY3Rpb25bMV0sIHZzdGFjaywgbHN0YWNrKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgciAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgIHN0YWNrID0gc3RhY2suc2xpY2UoMCwgLTEgKiBsZW4gKiAyKTtcbiAgICAgICAgICAgICAgICB2c3RhY2sgPSB2c3RhY2suc2xpY2UoMCwgLTEgKiBsZW4pO1xuICAgICAgICAgICAgICAgIGxzdGFjayA9IGxzdGFjay5zbGljZSgwLCAtMSAqIGxlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGFjay5wdXNoKHRoaXMucHJvZHVjdGlvbnNfW2FjdGlvblsxXV1bMF0pO1xuICAgICAgICAgICAgdnN0YWNrLnB1c2goeXl2YWwuJCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaCh5eXZhbC5fJCk7XG4gICAgICAgICAgICBuZXdTdGF0ZSA9IHRhYmxlW3N0YWNrW3N0YWNrLmxlbmd0aCAtIDJdXVtzdGFja1tzdGFjay5sZW5ndGggLSAxXV07XG4gICAgICAgICAgICBzdGFjay5wdXNoKG5ld1N0YXRlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn1cbn07XG4vKiBKaXNvbiBnZW5lcmF0ZWQgbGV4ZXIgKi9cbnZhciBsZXhlciA9IChmdW5jdGlvbigpe1xudmFyIGxleGVyID0gKHtFT0Y6MSxcbnBhcnNlRXJyb3I6ZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICAgICAgaWYgKHRoaXMueXkucGFyc2VyKSB7XG4gICAgICAgICAgICB0aGlzLnl5LnBhcnNlci5wYXJzZUVycm9yKHN0ciwgaGFzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3Ioc3RyKTtcbiAgICAgICAgfVxuICAgIH0sXG5zZXRJbnB1dDpmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgdGhpcy5faW5wdXQgPSBpbnB1dDtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRoaXMuX2xlc3MgPSB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy55eWxpbmVubyA9IHRoaXMueXlsZW5nID0gMDtcbiAgICAgICAgdGhpcy55eXRleHQgPSB0aGlzLm1hdGNoZWQgPSB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uU3RhY2sgPSBbJ0lOSVRJQUwnXTtcbiAgICAgICAgdGhpcy55eWxsb2MgPSB7Zmlyc3RfbGluZToxLGZpcnN0X2NvbHVtbjowLGxhc3RfbGluZToxLGxhc3RfY29sdW1uOjB9O1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykgdGhpcy55eWxsb2MucmFuZ2UgPSBbMCwwXTtcbiAgICAgICAgdGhpcy5vZmZzZXQgPSAwO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuaW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY2ggPSB0aGlzLl9pbnB1dFswXTtcbiAgICAgICAgdGhpcy55eXRleHQgKz0gY2g7XG4gICAgICAgIHRoaXMueXlsZW5nKys7XG4gICAgICAgIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgIHRoaXMubWF0Y2ggKz0gY2g7XG4gICAgICAgIHRoaXMubWF0Y2hlZCArPSBjaDtcbiAgICAgICAgdmFyIGxpbmVzID0gY2gubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICBpZiAobGluZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsaW5lbm8rKztcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLmxhc3RfbGluZSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy55eWxsb2MubGFzdF9jb2x1bW4rKztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykgdGhpcy55eWxsb2MucmFuZ2VbMV0rKztcblxuICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKDEpO1xuICAgICAgICByZXR1cm4gY2g7XG4gICAgfSxcbnVucHV0OmZ1bmN0aW9uIChjaCkge1xuICAgICAgICB2YXIgbGVuID0gY2gubGVuZ3RoO1xuICAgICAgICB2YXIgbGluZXMgPSBjaC5zcGxpdCgvKD86XFxyXFxuP3xcXG4pL2cpO1xuXG4gICAgICAgIHRoaXMuX2lucHV0ID0gY2ggKyB0aGlzLl9pbnB1dDtcbiAgICAgICAgdGhpcy55eXRleHQgPSB0aGlzLnl5dGV4dC5zdWJzdHIoMCwgdGhpcy55eXRleHQubGVuZ3RoLWxlbi0xKTtcbiAgICAgICAgLy90aGlzLnl5bGVuZyAtPSBsZW47XG4gICAgICAgIHRoaXMub2Zmc2V0IC09IGxlbjtcbiAgICAgICAgdmFyIG9sZExpbmVzID0gdGhpcy5tYXRjaC5zcGxpdCgvKD86XFxyXFxuP3xcXG4pL2cpO1xuICAgICAgICB0aGlzLm1hdGNoID0gdGhpcy5tYXRjaC5zdWJzdHIoMCwgdGhpcy5tYXRjaC5sZW5ndGgtMSk7XG4gICAgICAgIHRoaXMubWF0Y2hlZCA9IHRoaXMubWF0Y2hlZC5zdWJzdHIoMCwgdGhpcy5tYXRjaGVkLmxlbmd0aC0xKTtcblxuICAgICAgICBpZiAobGluZXMubGVuZ3RoLTEpIHRoaXMueXlsaW5lbm8gLT0gbGluZXMubGVuZ3RoLTE7XG4gICAgICAgIHZhciByID0gdGhpcy55eWxsb2MucmFuZ2U7XG5cbiAgICAgICAgdGhpcy55eWxsb2MgPSB7Zmlyc3RfbGluZTogdGhpcy55eWxsb2MuZmlyc3RfbGluZSxcbiAgICAgICAgICBsYXN0X2xpbmU6IHRoaXMueXlsaW5lbm8rMSxcbiAgICAgICAgICBmaXJzdF9jb2x1bW46IHRoaXMueXlsbG9jLmZpcnN0X2NvbHVtbixcbiAgICAgICAgICBsYXN0X2NvbHVtbjogbGluZXMgP1xuICAgICAgICAgICAgICAobGluZXMubGVuZ3RoID09PSBvbGRMaW5lcy5sZW5ndGggPyB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gOiAwKSArIG9sZExpbmVzW29sZExpbmVzLmxlbmd0aCAtIGxpbmVzLmxlbmd0aF0ubGVuZ3RoIC0gbGluZXNbMF0ubGVuZ3RoOlxuICAgICAgICAgICAgICB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gLSBsZW5cbiAgICAgICAgICB9O1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5yYW5nZSA9IFtyWzBdLCByWzBdICsgdGhpcy55eWxlbmcgLSBsZW5dO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5tb3JlOmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5sZXNzOmZ1bmN0aW9uIChuKSB7XG4gICAgICAgIHRoaXMudW5wdXQodGhpcy5tYXRjaC5zbGljZShuKSk7XG4gICAgfSxcbnBhc3RJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwYXN0ID0gdGhpcy5tYXRjaGVkLnN1YnN0cigwLCB0aGlzLm1hdGNoZWQubGVuZ3RoIC0gdGhpcy5tYXRjaC5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gKHBhc3QubGVuZ3RoID4gMjAgPyAnLi4uJzonJykgKyBwYXN0LnN1YnN0cigtMjApLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxudXBjb21pbmdJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuZXh0ID0gdGhpcy5tYXRjaDtcbiAgICAgICAgaWYgKG5leHQubGVuZ3RoIDwgMjApIHtcbiAgICAgICAgICAgIG5leHQgKz0gdGhpcy5faW5wdXQuc3Vic3RyKDAsIDIwLW5leHQubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKG5leHQuc3Vic3RyKDAsMjApKyhuZXh0Lmxlbmd0aCA+IDIwID8gJy4uLic6JycpKS5yZXBsYWNlKC9cXG4vZywgXCJcIik7XG4gICAgfSxcbnNob3dQb3NpdGlvbjpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwcmUgPSB0aGlzLnBhc3RJbnB1dCgpO1xuICAgICAgICB2YXIgYyA9IG5ldyBBcnJheShwcmUubGVuZ3RoICsgMSkuam9pbihcIi1cIik7XG4gICAgICAgIHJldHVybiBwcmUgKyB0aGlzLnVwY29taW5nSW5wdXQoKSArIFwiXFxuXCIgKyBjK1wiXlwiO1xuICAgIH0sXG5uZXh0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuZG9uZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5faW5wdXQpIHRoaXMuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgdmFyIHRva2VuLFxuICAgICAgICAgICAgbWF0Y2gsXG4gICAgICAgICAgICB0ZW1wTWF0Y2gsXG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIGNvbCxcbiAgICAgICAgICAgIGxpbmVzO1xuICAgICAgICBpZiAoIXRoaXMuX21vcmUpIHtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ID0gJyc7XG4gICAgICAgICAgICB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJ1bGVzID0gdGhpcy5fY3VycmVudFJ1bGVzKCk7XG4gICAgICAgIGZvciAodmFyIGk9MDtpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRlbXBNYXRjaCA9IHRoaXMuX2lucHV0Lm1hdGNoKHRoaXMucnVsZXNbcnVsZXNbaV1dKTtcbiAgICAgICAgICAgIGlmICh0ZW1wTWF0Y2ggJiYgKCFtYXRjaCB8fCB0ZW1wTWF0Y2hbMF0ubGVuZ3RoID4gbWF0Y2hbMF0ubGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoID0gdGVtcE1hdGNoO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5mbGV4KSBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGxpbmVzID0gbWF0Y2hbMF0ubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICAgICAgaWYgKGxpbmVzKSB0aGlzLnl5bGluZW5vICs9IGxpbmVzLmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jID0ge2ZpcnN0X2xpbmU6IHRoaXMueXlsbG9jLmxhc3RfbGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RfbGluZTogdGhpcy55eWxpbmVubysxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3RfY29sdW1uOiB0aGlzLnl5bGxvYy5sYXN0X2NvbHVtbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RfY29sdW1uOiBsaW5lcyA/IGxpbmVzW2xpbmVzLmxlbmd0aC0xXS5sZW5ndGgtbGluZXNbbGluZXMubGVuZ3RoLTFdLm1hdGNoKC9cXHI/XFxuPy8pWzBdLmxlbmd0aCA6IHRoaXMueXlsbG9jLmxhc3RfY29sdW1uICsgbWF0Y2hbMF0ubGVuZ3RofTtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ICs9IG1hdGNoWzBdO1xuICAgICAgICAgICAgdGhpcy5tYXRjaCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIHRoaXMubWF0Y2hlcyA9IG1hdGNoO1xuICAgICAgICAgICAgdGhpcy55eWxlbmcgPSB0aGlzLnl5dGV4dC5sZW5ndGg7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykge1xuICAgICAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3RoaXMub2Zmc2V0LCB0aGlzLm9mZnNldCArPSB0aGlzLnl5bGVuZ107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tb3JlID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgICAgICB0aGlzLm1hdGNoZWQgKz0gbWF0Y2hbMF07XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMucGVyZm9ybUFjdGlvbi5jYWxsKHRoaXMsIHRoaXMueXksIHRoaXMsIHJ1bGVzW2luZGV4XSx0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTFdKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmRvbmUgJiYgdGhpcy5faW5wdXQpIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHRva2VuKSByZXR1cm4gdG9rZW47XG4gICAgICAgICAgICBlbHNlIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5faW5wdXQgPT09IFwiXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVPRjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlRXJyb3IoJ0xleGljYWwgZXJyb3Igb24gbGluZSAnKyh0aGlzLnl5bGluZW5vKzEpKycuIFVucmVjb2duaXplZCB0ZXh0LlxcbicrdGhpcy5zaG93UG9zaXRpb24oKSxcbiAgICAgICAgICAgICAgICAgICAge3RleHQ6IFwiXCIsIHRva2VuOiBudWxsLCBsaW5lOiB0aGlzLnl5bGluZW5vfSk7XG4gICAgICAgIH1cbiAgICB9LFxubGV4OmZ1bmN0aW9uIGxleCgpIHtcbiAgICAgICAgdmFyIHIgPSB0aGlzLm5leHQoKTtcbiAgICAgICAgaWYgKHR5cGVvZiByICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5sZXgoKTtcbiAgICAgICAgfVxuICAgIH0sXG5iZWdpbjpmdW5jdGlvbiBiZWdpbihjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5jb25kaXRpb25TdGFjay5wdXNoKGNvbmRpdGlvbik7XG4gICAgfSxcbnBvcFN0YXRlOmZ1bmN0aW9uIHBvcFN0YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25TdGFjay5wb3AoKTtcbiAgICB9LFxuX2N1cnJlbnRSdWxlczpmdW5jdGlvbiBfY3VycmVudFJ1bGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25zW3RoaXMuY29uZGl0aW9uU3RhY2tbdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGgtMV1dLnJ1bGVzO1xuICAgIH0sXG50b3BTdGF0ZTpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTJdO1xuICAgIH0sXG5wdXNoU3RhdGU6ZnVuY3Rpb24gYmVnaW4oY29uZGl0aW9uKSB7XG4gICAgICAgIHRoaXMuYmVnaW4oY29uZGl0aW9uKTtcbiAgICB9fSk7XG5sZXhlci5vcHRpb25zID0ge307XG5sZXhlci5wZXJmb3JtQWN0aW9uID0gZnVuY3Rpb24gYW5vbnltb3VzKHl5LHl5XywkYXZvaWRpbmdfbmFtZV9jb2xsaXNpb25zLFlZX1NUQVJUXG4vKiovKSB7XG5cblxuZnVuY3Rpb24gc3RyaXAoc3RhcnQsIGVuZCkge1xuICByZXR1cm4geXlfLnl5dGV4dCA9IHl5Xy55eXRleHQuc3Vic3RyKHN0YXJ0LCB5eV8ueXlsZW5nLWVuZCk7XG59XG5cblxudmFyIFlZU1RBVEU9WVlfU1RBUlRcbnN3aXRjaCgkYXZvaWRpbmdfbmFtZV9jb2xsaXNpb25zKSB7XG5jYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHl5Xy55eXRleHQuc2xpY2UoLTIpID09PSBcIlxcXFxcXFxcXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJpcCgwLDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmVnaW4oXCJtdVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmKHl5Xy55eXRleHQuc2xpY2UoLTEpID09PSBcIlxcXFxcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cmlwKDAsMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iZWdpbihcImVtdVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJlZ2luKFwibXVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoeXlfLnl5dGV4dCkgcmV0dXJuIDE1O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG5icmVhaztcbmNhc2UgMTpyZXR1cm4gMTU7XG5icmVhaztcbmNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3BTdGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSAzOnRoaXMuYmVnaW4oJ3JhdycpOyByZXR1cm4gMTU7XG5icmVhaztcbmNhc2UgNDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvcFN0YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2hvdWxkIGJlIHVzaW5nIGB0aGlzLnRvcFN0YXRlKClgIGJlbG93LCBidXQgaXQgY3VycmVudGx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmV0dXJucyB0aGUgc2Vjb25kIHRvcCBpbnN0ZWFkIG9mIHRoZSBmaXJzdCB0b3AuIE9wZW5lZCBhblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzc3VlIGFib3V0IGl0IGF0IGh0dHBzOi8vZ2l0aHViLmNvbS96YWFjaC9qaXNvbi9pc3N1ZXMvMjkxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZGl0aW9uU3RhY2tbdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGgtMV0gPT09ICdyYXcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHl5Xy55eXRleHQgPSB5eV8ueXl0ZXh0LnN1YnN0cig1LCB5eV8ueXlsZW5nLTkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdFTkRfUkFXX0JMT0NLJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSA1OiByZXR1cm4gMTU7IFxuYnJlYWs7XG5jYXNlIDY6XG4gIHRoaXMucG9wU3RhdGUoKTtcbiAgcmV0dXJuIDE0O1xuXG5icmVhaztcbmNhc2UgNzpyZXR1cm4gNjU7XG5icmVhaztcbmNhc2UgODpyZXR1cm4gNjg7XG5icmVhaztcbmNhc2UgOTogcmV0dXJuIDE5OyBcbmJyZWFrO1xuY2FzZSAxMDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvcFN0YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iZWdpbigncmF3Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDIzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG5icmVhaztcbmNhc2UgMTE6cmV0dXJuIDU1O1xuYnJlYWs7XG5jYXNlIDEyOnJldHVybiA2MDtcbmJyZWFrO1xuY2FzZSAxMzpyZXR1cm4gMjk7XG5icmVhaztcbmNhc2UgMTQ6cmV0dXJuIDQ3O1xuYnJlYWs7XG5jYXNlIDE1OnRoaXMucG9wU3RhdGUoKTsgcmV0dXJuIDQ0O1xuYnJlYWs7XG5jYXNlIDE2OnRoaXMucG9wU3RhdGUoKTsgcmV0dXJuIDQ0O1xuYnJlYWs7XG5jYXNlIDE3OnJldHVybiAzNDtcbmJyZWFrO1xuY2FzZSAxODpyZXR1cm4gMzk7XG5icmVhaztcbmNhc2UgMTk6cmV0dXJuIDUxO1xuYnJlYWs7XG5jYXNlIDIwOnJldHVybiA0ODtcbmJyZWFrO1xuY2FzZSAyMTpcbiAgdGhpcy51bnB1dCh5eV8ueXl0ZXh0KTtcbiAgdGhpcy5wb3BTdGF0ZSgpO1xuICB0aGlzLmJlZ2luKCdjb20nKTtcblxuYnJlYWs7XG5jYXNlIDIyOlxuICB0aGlzLnBvcFN0YXRlKCk7XG4gIHJldHVybiAxNDtcblxuYnJlYWs7XG5jYXNlIDIzOnJldHVybiA0ODtcbmJyZWFrO1xuY2FzZSAyNDpyZXR1cm4gNzM7XG5icmVhaztcbmNhc2UgMjU6cmV0dXJuIDcyO1xuYnJlYWs7XG5jYXNlIDI2OnJldHVybiA3MjtcbmJyZWFrO1xuY2FzZSAyNzpyZXR1cm4gODc7XG5icmVhaztcbmNhc2UgMjg6Ly8gaWdub3JlIHdoaXRlc3BhY2VcbmJyZWFrO1xuY2FzZSAyOTp0aGlzLnBvcFN0YXRlKCk7IHJldHVybiA1NDtcbmJyZWFrO1xuY2FzZSAzMDp0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAzMztcbmJyZWFrO1xuY2FzZSAzMTp5eV8ueXl0ZXh0ID0gc3RyaXAoMSwyKS5yZXBsYWNlKC9cXFxcXCIvZywnXCInKTsgcmV0dXJuIDgwO1xuYnJlYWs7XG5jYXNlIDMyOnl5Xy55eXRleHQgPSBzdHJpcCgxLDIpLnJlcGxhY2UoL1xcXFwnL2csXCInXCIpOyByZXR1cm4gODA7XG5icmVhaztcbmNhc2UgMzM6cmV0dXJuIDg1O1xuYnJlYWs7XG5jYXNlIDM0OnJldHVybiA4MjtcbmJyZWFrO1xuY2FzZSAzNTpyZXR1cm4gODI7XG5icmVhaztcbmNhc2UgMzY6cmV0dXJuIDgzO1xuYnJlYWs7XG5jYXNlIDM3OnJldHVybiA4NDtcbmJyZWFrO1xuY2FzZSAzODpyZXR1cm4gODE7XG5icmVhaztcbmNhc2UgMzk6cmV0dXJuIDc1O1xuYnJlYWs7XG5jYXNlIDQwOnJldHVybiA3NztcbmJyZWFrO1xuY2FzZSA0MTpyZXR1cm4gNzI7XG5icmVhaztcbmNhc2UgNDI6eXlfLnl5dGV4dCA9IHl5Xy55eXRleHQucmVwbGFjZSgvXFxcXChbXFxcXFxcXV0pL2csJyQxJyk7IHJldHVybiA3MjtcbmJyZWFrO1xuY2FzZSA0MzpyZXR1cm4gJ0lOVkFMSUQnO1xuYnJlYWs7XG5jYXNlIDQ0OnJldHVybiA1O1xuYnJlYWs7XG59XG59O1xubGV4ZXIucnVsZXMgPSBbL14oPzpbXlxceDAwXSo/KD89KFxce1xceykpKS8sL14oPzpbXlxceDAwXSspLywvXig/OlteXFx4MDBdezIsfT8oPz0oXFx7XFx7fFxcXFxcXHtcXHt8XFxcXFxcXFxcXHtcXHt8JCkpKS8sL14oPzpcXHtcXHtcXHtcXHsoPz1bXlxcL10pKS8sL14oPzpcXHtcXHtcXHtcXHtcXC9bXlxccyFcIiMlLSxcXC5cXC87LT5AXFxbLVxcXmBcXHstfl0rKD89Wz19XFxzXFwvLl0pXFx9XFx9XFx9XFx9KS8sL14oPzpbXlxceDAwXSo/KD89KFxce1xce1xce1xceykpKS8sL14oPzpbXFxzXFxTXSo/LS0ofik/XFx9XFx9KS8sL14oPzpcXCgpLywvXig/OlxcKSkvLC9eKD86XFx7XFx7XFx7XFx7KS8sL14oPzpcXH1cXH1cXH1cXH0pLywvXig/Olxce1xceyh+KT8+KS8sL14oPzpcXHtcXHsofik/Iz4pLywvXig/Olxce1xceyh+KT8jXFwqPykvLC9eKD86XFx7XFx7KH4pP1xcLykvLC9eKD86XFx7XFx7KH4pP1xcXlxccyoofik/XFx9XFx9KS8sL14oPzpcXHtcXHsofik/XFxzKmVsc2VcXHMqKH4pP1xcfVxcfSkvLC9eKD86XFx7XFx7KH4pP1xcXikvLC9eKD86XFx7XFx7KH4pP1xccyplbHNlXFxiKS8sL14oPzpcXHtcXHsofik/XFx7KS8sL14oPzpcXHtcXHsofik/JikvLC9eKD86XFx7XFx7KH4pPyEtLSkvLC9eKD86XFx7XFx7KH4pPyFbXFxzXFxTXSo/XFx9XFx9KS8sL14oPzpcXHtcXHsofik/XFwqPykvLC9eKD86PSkvLC9eKD86XFwuXFwuKS8sL14oPzpcXC4oPz0oWz1+fVxcc1xcLy4pfF0pKSkvLC9eKD86W1xcLy5dKS8sL14oPzpcXHMrKS8sL14oPzpcXH0ofik/XFx9XFx9KS8sL14oPzoofik/XFx9XFx9KS8sL14oPzpcIihcXFxcW1wiXXxbXlwiXSkqXCIpLywvXig/OicoXFxcXFsnXXxbXiddKSonKS8sL14oPzpAKS8sL14oPzp0cnVlKD89KFt+fVxccyldKSkpLywvXig/OmZhbHNlKD89KFt+fVxccyldKSkpLywvXig/OnVuZGVmaW5lZCg/PShbfn1cXHMpXSkpKS8sL14oPzpudWxsKD89KFt+fVxccyldKSkpLywvXig/Oi0/WzAtOV0rKD86XFwuWzAtOV0rKT8oPz0oW359XFxzKV0pKSkvLC9eKD86YXNcXHMrXFx8KS8sL14oPzpcXHwpLywvXig/OihbXlxccyFcIiMlLSxcXC5cXC87LT5AXFxbLVxcXmBcXHstfl0rKD89KFs9fn1cXHNcXC8uKXxdKSkpKS8sL14oPzpcXFsoXFxcXFxcXXxbXlxcXV0pKlxcXSkvLC9eKD86LikvLC9eKD86JCkvXTtcbmxleGVyLmNvbmRpdGlvbnMgPSB7XCJtdVwiOntcInJ1bGVzXCI6WzcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDI5LDMwLDMxLDMyLDMzLDM0LDM1LDM2LDM3LDM4LDM5LDQwLDQxLDQyLDQzLDQ0XSxcImluY2x1c2l2ZVwiOmZhbHNlfSxcImVtdVwiOntcInJ1bGVzXCI6WzJdLFwiaW5jbHVzaXZlXCI6ZmFsc2V9LFwiY29tXCI6e1wicnVsZXNcIjpbNl0sXCJpbmNsdXNpdmVcIjpmYWxzZX0sXCJyYXdcIjp7XCJydWxlc1wiOlszLDQsNV0sXCJpbmNsdXNpdmVcIjpmYWxzZX0sXCJJTklUSUFMXCI6e1wicnVsZXNcIjpbMCwxLDQ0XSxcImluY2x1c2l2ZVwiOnRydWV9fTtcbnJldHVybiBsZXhlcjt9KSgpXG5wYXJzZXIubGV4ZXIgPSBsZXhlcjtcbmZ1bmN0aW9uIFBhcnNlciAoKSB7IHRoaXMueXkgPSB7fTsgfVBhcnNlci5wcm90b3R5cGUgPSBwYXJzZXI7cGFyc2VyLlBhcnNlciA9IFBhcnNlcjtcbnJldHVybiBuZXcgUGFyc2VyO1xufSkoKTtleHBvcnQgZGVmYXVsdCBoYW5kbGViYXJzO1xuIiwiLyogZXNsaW50LWRpc2FibGUgbmV3LWNhcCAqL1xuaW1wb3J0IFZpc2l0b3IgZnJvbSAnLi92aXNpdG9yJztcblxuZXhwb3J0IGZ1bmN0aW9uIHByaW50KGFzdCkge1xuICByZXR1cm4gbmV3IFByaW50VmlzaXRvcigpLmFjY2VwdChhc3QpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gUHJpbnRWaXNpdG9yKCkge1xuICB0aGlzLnBhZGRpbmcgPSAwO1xufVxuXG5QcmludFZpc2l0b3IucHJvdG90eXBlID0gbmV3IFZpc2l0b3IoKTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wYWQgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgbGV0IG91dCA9ICcnO1xuXG4gIGZvciAobGV0IGkgPSAwLCBsID0gdGhpcy5wYWRkaW5nOyBpIDwgbDsgaSsrKSB7XG4gICAgb3V0ICs9ICcgICc7XG4gIH1cblxuICBvdXQgKz0gc3RyaW5nICsgJ1xcbic7XG4gIHJldHVybiBvdXQ7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLlByb2dyYW0gPSBmdW5jdGlvbihwcm9ncmFtKSB7XG4gIGxldCBvdXQgPSAnJyxcbiAgICAgIGJvZHkgPSBwcm9ncmFtLmJvZHksXG4gICAgICBpLCBsO1xuXG4gIGlmIChwcm9ncmFtLmJsb2NrUGFyYW1zKSB7XG4gICAgbGV0IGJsb2NrUGFyYW1zID0gJ0JMT0NLIFBBUkFNUzogWyc7XG4gICAgZm9yIChpID0gMCwgbCA9IHByb2dyYW0uYmxvY2tQYXJhbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgYmxvY2tQYXJhbXMgKz0gJyAnICsgcHJvZ3JhbS5ibG9ja1BhcmFtc1tpXTtcbiAgICB9XG4gICAgYmxvY2tQYXJhbXMgKz0gJyBdJztcbiAgICBvdXQgKz0gdGhpcy5wYWQoYmxvY2tQYXJhbXMpO1xuICB9XG5cbiAgZm9yIChpID0gMCwgbCA9IGJvZHkubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgb3V0ICs9IHRoaXMuYWNjZXB0KGJvZHlbaV0pO1xuICB9XG5cbiAgdGhpcy5wYWRkaW5nLS07XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuTXVzdGFjaGVTdGF0ZW1lbnQgPSBmdW5jdGlvbihtdXN0YWNoZSkge1xuICByZXR1cm4gdGhpcy5wYWQoJ3t7ICcgKyB0aGlzLlN1YkV4cHJlc3Npb24obXVzdGFjaGUpICsgJyB9fScpO1xufTtcblByaW50VmlzaXRvci5wcm90b3R5cGUuRGVjb3JhdG9yID0gZnVuY3Rpb24obXVzdGFjaGUpIHtcbiAgcmV0dXJuIHRoaXMucGFkKCd7eyBESVJFQ1RJVkUgJyArIHRoaXMuU3ViRXhwcmVzc2lvbihtdXN0YWNoZSkgKyAnIH19Jyk7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLkJsb2NrU3RhdGVtZW50ID1cblByaW50VmlzaXRvci5wcm90b3R5cGUuRGVjb3JhdG9yQmxvY2sgPSBmdW5jdGlvbihibG9jaykge1xuICBsZXQgb3V0ID0gJyc7XG5cbiAgb3V0ICs9IHRoaXMucGFkKChibG9jay50eXBlID09PSAnRGVjb3JhdG9yQmxvY2snID8gJ0RJUkVDVElWRSAnIDogJycpICsgJ0JMT0NLOicpO1xuICB0aGlzLnBhZGRpbmcrKztcbiAgb3V0ICs9IHRoaXMucGFkKHRoaXMuU3ViRXhwcmVzc2lvbihibG9jaykpO1xuICBpZiAoYmxvY2sucHJvZ3JhbSkge1xuICAgIG91dCArPSB0aGlzLnBhZCgnUFJPR1JBTTonKTtcbiAgICB0aGlzLnBhZGRpbmcrKztcbiAgICBvdXQgKz0gdGhpcy5hY2NlcHQoYmxvY2sucHJvZ3JhbSk7XG4gICAgdGhpcy5wYWRkaW5nLS07XG4gIH1cbiAgaWYgKGJsb2NrLmludmVyc2UpIHtcbiAgICBpZiAoYmxvY2sucHJvZ3JhbSkgeyB0aGlzLnBhZGRpbmcrKzsgfVxuICAgIG91dCArPSB0aGlzLnBhZCgne3tefX0nKTtcbiAgICB0aGlzLnBhZGRpbmcrKztcbiAgICBvdXQgKz0gdGhpcy5hY2NlcHQoYmxvY2suaW52ZXJzZSk7XG4gICAgdGhpcy5wYWRkaW5nLS07XG4gICAgaWYgKGJsb2NrLnByb2dyYW0pIHsgdGhpcy5wYWRkaW5nLS07IH1cbiAgfVxuICB0aGlzLnBhZGRpbmctLTtcblxuICByZXR1cm4gb3V0O1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5QYXJ0aWFsU3RhdGVtZW50ID0gZnVuY3Rpb24ocGFydGlhbCkge1xuICBsZXQgY29udGVudCA9ICdQQVJUSUFMOicgKyBwYXJ0aWFsLm5hbWUub3JpZ2luYWw7XG4gIGlmIChwYXJ0aWFsLnBhcmFtc1swXSkge1xuICAgIGNvbnRlbnQgKz0gJyAnICsgdGhpcy5hY2NlcHQocGFydGlhbC5wYXJhbXNbMF0pO1xuICB9XG4gIGlmIChwYXJ0aWFsLmhhc2gpIHtcbiAgICBjb250ZW50ICs9ICcgJyArIHRoaXMuYWNjZXB0KHBhcnRpYWwuaGFzaCk7XG4gIH1cbiAgcmV0dXJuIHRoaXMucGFkKCd7ez4gJyArIGNvbnRlbnQgKyAnIH19Jyk7XG59O1xuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5QYXJ0aWFsQmxvY2tTdGF0ZW1lbnQgPSBmdW5jdGlvbihwYXJ0aWFsKSB7XG4gIGxldCBjb250ZW50ID0gJ1BBUlRJQUwgQkxPQ0s6JyArIHBhcnRpYWwubmFtZS5vcmlnaW5hbDtcbiAgaWYgKHBhcnRpYWwucGFyYW1zWzBdKSB7XG4gICAgY29udGVudCArPSAnICcgKyB0aGlzLmFjY2VwdChwYXJ0aWFsLnBhcmFtc1swXSk7XG4gIH1cbiAgaWYgKHBhcnRpYWwuaGFzaCkge1xuICAgIGNvbnRlbnQgKz0gJyAnICsgdGhpcy5hY2NlcHQocGFydGlhbC5oYXNoKTtcbiAgfVxuXG4gIGNvbnRlbnQgKz0gJyAnICsgdGhpcy5wYWQoJ1BST0dSQU06Jyk7XG4gIHRoaXMucGFkZGluZysrO1xuICBjb250ZW50ICs9IHRoaXMuYWNjZXB0KHBhcnRpYWwucHJvZ3JhbSk7XG4gIHRoaXMucGFkZGluZy0tO1xuXG4gIHJldHVybiB0aGlzLnBhZCgne3s+ICcgKyBjb250ZW50ICsgJyB9fScpO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5Db250ZW50U3RhdGVtZW50ID0gZnVuY3Rpb24oY29udGVudCkge1xuICByZXR1cm4gdGhpcy5wYWQoXCJDT05URU5UWyAnXCIgKyBjb250ZW50LnZhbHVlICsgXCInIF1cIik7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLkNvbW1lbnRTdGF0ZW1lbnQgPSBmdW5jdGlvbihjb21tZW50KSB7XG4gIHJldHVybiB0aGlzLnBhZChcInt7ISAnXCIgKyBjb21tZW50LnZhbHVlICsgXCInIH19XCIpO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5TdWJFeHByZXNzaW9uID0gZnVuY3Rpb24oc2V4cHIpIHtcbiAgbGV0IHBhcmFtcyA9IHNleHByLnBhcmFtcyxcbiAgICAgIHBhcmFtU3RyaW5ncyA9IFtdLFxuICAgICAgaGFzaDtcblxuICBmb3IgKGxldCBpID0gMCwgbCA9IHBhcmFtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBwYXJhbVN0cmluZ3MucHVzaCh0aGlzLmFjY2VwdChwYXJhbXNbaV0pKTtcbiAgfVxuXG4gIHBhcmFtcyA9ICdbJyArIHBhcmFtU3RyaW5ncy5qb2luKCcsICcpICsgJ10nO1xuXG4gIGhhc2ggPSBzZXhwci5oYXNoID8gJyAnICsgdGhpcy5hY2NlcHQoc2V4cHIuaGFzaCkgOiAnJztcblxuICByZXR1cm4gdGhpcy5hY2NlcHQoc2V4cHIucGF0aCkgKyAnICcgKyBwYXJhbXMgKyBoYXNoO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5QYXRoRXhwcmVzc2lvbiA9IGZ1bmN0aW9uKGlkKSB7XG4gIGxldCBwYXRoID0gaWQucGFydHMuam9pbignLycpO1xuICByZXR1cm4gKGlkLmRhdGEgPyAnQCcgOiAnJykgKyAnUEFUSDonICsgcGF0aDtcbn07XG5cblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5TdHJpbmdMaXRlcmFsID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gIHJldHVybiAnXCInICsgc3RyaW5nLnZhbHVlICsgJ1wiJztcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuTnVtYmVyTGl0ZXJhbCA9IGZ1bmN0aW9uKG51bWJlcikge1xuICByZXR1cm4gJ05VTUJFUnsnICsgbnVtYmVyLnZhbHVlICsgJ30nO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5Cb29sZWFuTGl0ZXJhbCA9IGZ1bmN0aW9uKGJvb2wpIHtcbiAgcmV0dXJuICdCT09MRUFOeycgKyBib29sLnZhbHVlICsgJ30nO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5VbmRlZmluZWRMaXRlcmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAnVU5ERUZJTkVEJztcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuTnVsbExpdGVyYWwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICdOVUxMJztcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuSGFzaCA9IGZ1bmN0aW9uKGhhc2gpIHtcbiAgbGV0IHBhaXJzID0gaGFzaC5wYWlycyxcbiAgICAgIGpvaW5lZFBhaXJzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDAsIGwgPSBwYWlycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBqb2luZWRQYWlycy5wdXNoKHRoaXMuYWNjZXB0KHBhaXJzW2ldKSk7XG4gIH1cblxuICByZXR1cm4gJ0hBU0h7JyArIGpvaW5lZFBhaXJzLmpvaW4oJywgJykgKyAnfSc7XG59O1xuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5IYXNoUGFpciA9IGZ1bmN0aW9uKHBhaXIpIHtcbiAgcmV0dXJuIHBhaXIua2V5ICsgJz0nICsgdGhpcy5hY2NlcHQocGFpci52YWx1ZSk7XG59O1xuLyogZXNsaW50LWVuYWJsZSBuZXctY2FwICovXG4iLCJpbXBvcnQgRXhjZXB0aW9uIGZyb20gJy4uL2V4Y2VwdGlvbic7XG5cbmZ1bmN0aW9uIFZpc2l0b3IoKSB7XG4gIHRoaXMucGFyZW50cyA9IFtdO1xufVxuXG5WaXNpdG9yLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFZpc2l0b3IsXG4gIG11dGF0aW5nOiBmYWxzZSxcblxuICAvLyBWaXNpdHMgYSBnaXZlbiB2YWx1ZS4gSWYgbXV0YXRpbmcsIHdpbGwgcmVwbGFjZSB0aGUgdmFsdWUgaWYgbmVjZXNzYXJ5LlxuICBhY2NlcHRLZXk6IGZ1bmN0aW9uKG5vZGUsIG5hbWUpIHtcbiAgICBsZXQgdmFsdWUgPSB0aGlzLmFjY2VwdChub2RlW25hbWVdKTtcbiAgICBpZiAodGhpcy5tdXRhdGluZykge1xuICAgICAgLy8gSGFja3kgc2FuaXR5IGNoZWNrOiBUaGlzIG1heSBoYXZlIGEgZmV3IGZhbHNlIHBvc2l0aXZlcyBmb3IgdHlwZSBmb3IgdGhlIGhlbHBlclxuICAgICAgLy8gbWV0aG9kcyBidXQgd2lsbCBnZW5lcmFsbHkgZG8gdGhlIHJpZ2h0IHRoaW5nIHdpdGhvdXQgYSBsb3Qgb2Ygb3ZlcmhlYWQuXG4gICAgICBpZiAodmFsdWUgJiYgIVZpc2l0b3IucHJvdG90eXBlW3ZhbHVlLnR5cGVdKSB7XG4gICAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ1VuZXhwZWN0ZWQgbm9kZSB0eXBlIFwiJyArIHZhbHVlLnR5cGUgKyAnXCIgZm91bmQgd2hlbiBhY2NlcHRpbmcgJyArIG5hbWUgKyAnIG9uICcgKyBub2RlLnR5cGUpO1xuICAgICAgfVxuICAgICAgbm9kZVtuYW1lXSA9IHZhbHVlO1xuICAgIH1cbiAgfSxcblxuICAvLyBQZXJmb3JtcyBhbiBhY2NlcHQgb3BlcmF0aW9uIHdpdGggYWRkZWQgc2FuaXR5IGNoZWNrIHRvIGVuc3VyZVxuICAvLyByZXF1aXJlZCBrZXlzIGFyZSBub3QgcmVtb3ZlZC5cbiAgYWNjZXB0UmVxdWlyZWQ6IGZ1bmN0aW9uKG5vZGUsIG5hbWUpIHtcbiAgICB0aGlzLmFjY2VwdEtleShub2RlLCBuYW1lKTtcblxuICAgIGlmICghbm9kZVtuYW1lXSkge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihub2RlLnR5cGUgKyAnIHJlcXVpcmVzICcgKyBuYW1lKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gVHJhdmVyc2VzIGEgZ2l2ZW4gYXJyYXkuIElmIG11dGF0aW5nLCBlbXB0eSByZXNwbnNlcyB3aWxsIGJlIHJlbW92ZWRcbiAgLy8gZm9yIGNoaWxkIGVsZW1lbnRzLlxuICBhY2NlcHRBcnJheTogZnVuY3Rpb24oYXJyYXkpIHtcbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGFycmF5Lmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdGhpcy5hY2NlcHRLZXkoYXJyYXksIGkpO1xuXG4gICAgICBpZiAoIWFycmF5W2ldKSB7XG4gICAgICAgIGFycmF5LnNwbGljZShpLCAxKTtcbiAgICAgICAgaS0tO1xuICAgICAgICBsLS07XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGFjY2VwdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgaWYgKCFvYmplY3QpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dDogU2FuaXR5IGNvZGUgKi9cbiAgICBpZiAoIXRoaXNbb2JqZWN0LnR5cGVdKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdVbmtub3duIHR5cGU6ICcgKyBvYmplY3QudHlwZSwgb2JqZWN0KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jdXJyZW50KSB7XG4gICAgICB0aGlzLnBhcmVudHMudW5zaGlmdCh0aGlzLmN1cnJlbnQpO1xuICAgIH1cbiAgICB0aGlzLmN1cnJlbnQgPSBvYmplY3Q7XG5cbiAgICBsZXQgcmV0ID0gdGhpc1tvYmplY3QudHlwZV0ob2JqZWN0KTtcblxuICAgIHRoaXMuY3VycmVudCA9IHRoaXMucGFyZW50cy5zaGlmdCgpO1xuXG4gICAgaWYgKCF0aGlzLm11dGF0aW5nIHx8IHJldCkge1xuICAgICAgcmV0dXJuIHJldDtcbiAgICB9IGVsc2UgaWYgKHJldCAhPT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuICB9LFxuXG4gIFByb2dyYW06IGZ1bmN0aW9uKHByb2dyYW0pIHtcbiAgICB0aGlzLmFjY2VwdEFycmF5KHByb2dyYW0uYm9keSk7XG4gIH0sXG5cbiAgTXVzdGFjaGVTdGF0ZW1lbnQ6IHZpc2l0U3ViRXhwcmVzc2lvbixcbiAgRGVjb3JhdG9yOiB2aXNpdFN1YkV4cHJlc3Npb24sXG5cbiAgQmxvY2tTdGF0ZW1lbnQ6IHZpc2l0QmxvY2ssXG4gIERlY29yYXRvckJsb2NrOiB2aXNpdEJsb2NrLFxuXG4gIFBhcnRpYWxTdGF0ZW1lbnQ6IHZpc2l0UGFydGlhbCxcbiAgUGFydGlhbEJsb2NrU3RhdGVtZW50OiBmdW5jdGlvbihwYXJ0aWFsKSB7XG4gICAgdmlzaXRQYXJ0aWFsLmNhbGwodGhpcywgcGFydGlhbCk7XG5cbiAgICB0aGlzLmFjY2VwdEtleShwYXJ0aWFsLCAncHJvZ3JhbScpO1xuICB9LFxuXG4gIENvbnRlbnRTdGF0ZW1lbnQ6IGZ1bmN0aW9uKC8qIGNvbnRlbnQgKi8pIHt9LFxuICBDb21tZW50U3RhdGVtZW50OiBmdW5jdGlvbigvKiBjb21tZW50ICovKSB7fSxcblxuICBTdWJFeHByZXNzaW9uOiB2aXNpdFN1YkV4cHJlc3Npb24sXG5cbiAgUGF0aEV4cHJlc3Npb246IGZ1bmN0aW9uKC8qIHBhdGggKi8pIHt9LFxuXG4gIFN0cmluZ0xpdGVyYWw6IGZ1bmN0aW9uKC8qIHN0cmluZyAqLykge30sXG4gIE51bWJlckxpdGVyYWw6IGZ1bmN0aW9uKC8qIG51bWJlciAqLykge30sXG4gIEJvb2xlYW5MaXRlcmFsOiBmdW5jdGlvbigvKiBib29sICovKSB7fSxcbiAgVW5kZWZpbmVkTGl0ZXJhbDogZnVuY3Rpb24oLyogbGl0ZXJhbCAqLykge30sXG4gIE51bGxMaXRlcmFsOiBmdW5jdGlvbigvKiBsaXRlcmFsICovKSB7fSxcblxuICBIYXNoOiBmdW5jdGlvbihoYXNoKSB7XG4gICAgdGhpcy5hY2NlcHRBcnJheShoYXNoLnBhaXJzKTtcbiAgfSxcbiAgSGFzaFBhaXI6IGZ1bmN0aW9uKHBhaXIpIHtcbiAgICB0aGlzLmFjY2VwdFJlcXVpcmVkKHBhaXIsICd2YWx1ZScpO1xuICB9XG59O1xuXG5mdW5jdGlvbiB2aXNpdFN1YkV4cHJlc3Npb24obXVzdGFjaGUpIHtcbiAgdGhpcy5hY2NlcHRSZXF1aXJlZChtdXN0YWNoZSwgJ3BhdGgnKTtcbiAgdGhpcy5hY2NlcHRBcnJheShtdXN0YWNoZS5wYXJhbXMpO1xuICB0aGlzLmFjY2VwdEtleShtdXN0YWNoZSwgJ2hhc2gnKTtcbn1cbmZ1bmN0aW9uIHZpc2l0QmxvY2soYmxvY2spIHtcbiAgdmlzaXRTdWJFeHByZXNzaW9uLmNhbGwodGhpcywgYmxvY2spO1xuXG4gIHRoaXMuYWNjZXB0S2V5KGJsb2NrLCAncHJvZ3JhbScpO1xuICB0aGlzLmFjY2VwdEtleShibG9jaywgJ2ludmVyc2UnKTtcbn1cbmZ1bmN0aW9uIHZpc2l0UGFydGlhbChwYXJ0aWFsKSB7XG4gIHRoaXMuYWNjZXB0UmVxdWlyZWQocGFydGlhbCwgJ25hbWUnKTtcbiAgdGhpcy5hY2NlcHRBcnJheShwYXJ0aWFsLnBhcmFtcyk7XG4gIHRoaXMuYWNjZXB0S2V5KHBhcnRpYWwsICdoYXNoJyk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IFZpc2l0b3I7XG4iLCJpbXBvcnQgVmlzaXRvciBmcm9tICcuL3Zpc2l0b3InO1xuXG5mdW5jdGlvbiBXaGl0ZXNwYWNlQ29udHJvbChvcHRpb25zID0ge30pIHtcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbn1cbldoaXRlc3BhY2VDb250cm9sLnByb3RvdHlwZSA9IG5ldyBWaXNpdG9yKCk7XG5cbldoaXRlc3BhY2VDb250cm9sLnByb3RvdHlwZS5Qcm9ncmFtID0gZnVuY3Rpb24ocHJvZ3JhbSkge1xuICBjb25zdCBkb1N0YW5kYWxvbmUgPSAhdGhpcy5vcHRpb25zLmlnbm9yZVN0YW5kYWxvbmU7XG5cbiAgbGV0IGlzUm9vdCA9ICF0aGlzLmlzUm9vdFNlZW47XG4gIHRoaXMuaXNSb290U2VlbiA9IHRydWU7XG5cbiAgbGV0IGJvZHkgPSBwcm9ncmFtLmJvZHk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gYm9keS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBsZXQgY3VycmVudCA9IGJvZHlbaV0sXG4gICAgICAgIHN0cmlwID0gdGhpcy5hY2NlcHQoY3VycmVudCk7XG5cbiAgICBpZiAoIXN0cmlwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsZXQgX2lzUHJldldoaXRlc3BhY2UgPSBpc1ByZXZXaGl0ZXNwYWNlKGJvZHksIGksIGlzUm9vdCksXG4gICAgICAgIF9pc05leHRXaGl0ZXNwYWNlID0gaXNOZXh0V2hpdGVzcGFjZShib2R5LCBpLCBpc1Jvb3QpLFxuXG4gICAgICAgIG9wZW5TdGFuZGFsb25lID0gc3RyaXAub3BlblN0YW5kYWxvbmUgJiYgX2lzUHJldldoaXRlc3BhY2UsXG4gICAgICAgIGNsb3NlU3RhbmRhbG9uZSA9IHN0cmlwLmNsb3NlU3RhbmRhbG9uZSAmJiBfaXNOZXh0V2hpdGVzcGFjZSxcbiAgICAgICAgaW5saW5lU3RhbmRhbG9uZSA9IHN0cmlwLmlubGluZVN0YW5kYWxvbmUgJiYgX2lzUHJldldoaXRlc3BhY2UgJiYgX2lzTmV4dFdoaXRlc3BhY2U7XG5cbiAgICBpZiAoc3RyaXAuY2xvc2UpIHtcbiAgICAgIG9taXRSaWdodChib2R5LCBpLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKHN0cmlwLm9wZW4pIHtcbiAgICAgIG9taXRMZWZ0KGJvZHksIGksIHRydWUpO1xuICAgIH1cblxuICAgIGlmIChkb1N0YW5kYWxvbmUgJiYgaW5saW5lU3RhbmRhbG9uZSkge1xuICAgICAgb21pdFJpZ2h0KGJvZHksIGkpO1xuXG4gICAgICBpZiAob21pdExlZnQoYm9keSwgaSkpIHtcbiAgICAgICAgLy8gSWYgd2UgYXJlIG9uIGEgc3RhbmRhbG9uZSBub2RlLCBzYXZlIHRoZSBpbmRlbnQgaW5mbyBmb3IgcGFydGlhbHNcbiAgICAgICAgaWYgKGN1cnJlbnQudHlwZSA9PT0gJ1BhcnRpYWxTdGF0ZW1lbnQnKSB7XG4gICAgICAgICAgLy8gUHVsbCBvdXQgdGhlIHdoaXRlc3BhY2UgZnJvbSB0aGUgZmluYWwgbGluZVxuICAgICAgICAgIGN1cnJlbnQuaW5kZW50ID0gKC8oWyBcXHRdKyQpLykuZXhlYyhib2R5W2kgLSAxXS5vcmlnaW5hbClbMV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGRvU3RhbmRhbG9uZSAmJiBvcGVuU3RhbmRhbG9uZSkge1xuICAgICAgb21pdFJpZ2h0KChjdXJyZW50LnByb2dyYW0gfHwgY3VycmVudC5pbnZlcnNlKS5ib2R5KTtcblxuICAgICAgLy8gU3RyaXAgb3V0IHRoZSBwcmV2aW91cyBjb250ZW50IG5vZGUgaWYgaXQncyB3aGl0ZXNwYWNlIG9ubHlcbiAgICAgIG9taXRMZWZ0KGJvZHksIGkpO1xuICAgIH1cbiAgICBpZiAoZG9TdGFuZGFsb25lICYmIGNsb3NlU3RhbmRhbG9uZSkge1xuICAgICAgLy8gQWx3YXlzIHN0cmlwIHRoZSBuZXh0IG5vZGVcbiAgICAgIG9taXRSaWdodChib2R5LCBpKTtcblxuICAgICAgb21pdExlZnQoKGN1cnJlbnQuaW52ZXJzZSB8fCBjdXJyZW50LnByb2dyYW0pLmJvZHkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwcm9ncmFtO1xufTtcblxuV2hpdGVzcGFjZUNvbnRyb2wucHJvdG90eXBlLkJsb2NrU3RhdGVtZW50ID1cbldoaXRlc3BhY2VDb250cm9sLnByb3RvdHlwZS5EZWNvcmF0b3JCbG9jayA9XG5XaGl0ZXNwYWNlQ29udHJvbC5wcm90b3R5cGUuUGFydGlhbEJsb2NrU3RhdGVtZW50ID0gZnVuY3Rpb24oYmxvY2spIHtcbiAgdGhpcy5hY2NlcHQoYmxvY2sucHJvZ3JhbSk7XG4gIHRoaXMuYWNjZXB0KGJsb2NrLmludmVyc2UpO1xuXG4gIC8vIEZpbmQgdGhlIGludmVyc2UgcHJvZ3JhbSB0aGF0IGlzIGludm9sZWQgd2l0aCB3aGl0ZXNwYWNlIHN0cmlwcGluZy5cbiAgbGV0IHByb2dyYW0gPSBibG9jay5wcm9ncmFtIHx8IGJsb2NrLmludmVyc2UsXG4gICAgICBpbnZlcnNlID0gYmxvY2sucHJvZ3JhbSAmJiBibG9jay5pbnZlcnNlLFxuICAgICAgZmlyc3RJbnZlcnNlID0gaW52ZXJzZSxcbiAgICAgIGxhc3RJbnZlcnNlID0gaW52ZXJzZTtcblxuICBpZiAoaW52ZXJzZSAmJiBpbnZlcnNlLmNoYWluZWQpIHtcbiAgICBmaXJzdEludmVyc2UgPSBpbnZlcnNlLmJvZHlbMF0ucHJvZ3JhbTtcblxuICAgIC8vIFdhbGsgdGhlIGludmVyc2UgY2hhaW4gdG8gZmluZCB0aGUgbGFzdCBpbnZlcnNlIHRoYXQgaXMgYWN0dWFsbHkgaW4gdGhlIGNoYWluLlxuICAgIHdoaWxlIChsYXN0SW52ZXJzZS5jaGFpbmVkKSB7XG4gICAgICBsYXN0SW52ZXJzZSA9IGxhc3RJbnZlcnNlLmJvZHlbbGFzdEludmVyc2UuYm9keS5sZW5ndGggLSAxXS5wcm9ncmFtO1xuICAgIH1cbiAgfVxuXG4gIGxldCBzdHJpcCA9IHtcbiAgICBvcGVuOiBibG9jay5vcGVuU3RyaXAub3BlbixcbiAgICBjbG9zZTogYmxvY2suY2xvc2VTdHJpcC5jbG9zZSxcblxuICAgIC8vIERldGVybWluZSB0aGUgc3RhbmRhbG9uZSBjYW5kaWFjeS4gQmFzaWNhbGx5IGZsYWcgb3VyIGNvbnRlbnQgYXMgYmVpbmcgcG9zc2libHkgc3RhbmRhbG9uZVxuICAgIC8vIHNvIG91ciBwYXJlbnQgY2FuIGRldGVybWluZSBpZiB3ZSBhY3R1YWxseSBhcmUgc3RhbmRhbG9uZVxuICAgIG9wZW5TdGFuZGFsb25lOiBpc05leHRXaGl0ZXNwYWNlKHByb2dyYW0uYm9keSksXG4gICAgY2xvc2VTdGFuZGFsb25lOiBpc1ByZXZXaGl0ZXNwYWNlKChmaXJzdEludmVyc2UgfHwgcHJvZ3JhbSkuYm9keSlcbiAgfTtcblxuICBpZiAoYmxvY2sub3BlblN0cmlwLmNsb3NlKSB7XG4gICAgb21pdFJpZ2h0KHByb2dyYW0uYm9keSwgbnVsbCwgdHJ1ZSk7XG4gIH1cblxuICBpZiAoaW52ZXJzZSkge1xuICAgIGxldCBpbnZlcnNlU3RyaXAgPSBibG9jay5pbnZlcnNlU3RyaXA7XG5cbiAgICBpZiAoaW52ZXJzZVN0cmlwLm9wZW4pIHtcbiAgICAgIG9taXRMZWZ0KHByb2dyYW0uYm9keSwgbnVsbCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKGludmVyc2VTdHJpcC5jbG9zZSkge1xuICAgICAgb21pdFJpZ2h0KGZpcnN0SW52ZXJzZS5ib2R5LCBudWxsLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKGJsb2NrLmNsb3NlU3RyaXAub3Blbikge1xuICAgICAgb21pdExlZnQobGFzdEludmVyc2UuYm9keSwgbnVsbCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLy8gRmluZCBzdGFuZGFsb25lIGVsc2Ugc3RhdG1lbnRzXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuaWdub3JlU3RhbmRhbG9uZVxuICAgICAgICAmJiBpc1ByZXZXaGl0ZXNwYWNlKHByb2dyYW0uYm9keSlcbiAgICAgICAgJiYgaXNOZXh0V2hpdGVzcGFjZShmaXJzdEludmVyc2UuYm9keSkpIHtcbiAgICAgIG9taXRMZWZ0KHByb2dyYW0uYm9keSk7XG4gICAgICBvbWl0UmlnaHQoZmlyc3RJbnZlcnNlLmJvZHkpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChibG9jay5jbG9zZVN0cmlwLm9wZW4pIHtcbiAgICBvbWl0TGVmdChwcm9ncmFtLmJvZHksIG51bGwsIHRydWUpO1xuICB9XG5cbiAgcmV0dXJuIHN0cmlwO1xufTtcblxuV2hpdGVzcGFjZUNvbnRyb2wucHJvdG90eXBlLkRlY29yYXRvciA9XG5XaGl0ZXNwYWNlQ29udHJvbC5wcm90b3R5cGUuTXVzdGFjaGVTdGF0ZW1lbnQgPSBmdW5jdGlvbihtdXN0YWNoZSkge1xuICByZXR1cm4gbXVzdGFjaGUuc3RyaXA7XG59O1xuXG5XaGl0ZXNwYWNlQ29udHJvbC5wcm90b3R5cGUuUGFydGlhbFN0YXRlbWVudCA9XG4gICAgV2hpdGVzcGFjZUNvbnRyb2wucHJvdG90eXBlLkNvbW1lbnRTdGF0ZW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIGxldCBzdHJpcCA9IG5vZGUuc3RyaXAgfHwge307XG4gIHJldHVybiB7XG4gICAgaW5saW5lU3RhbmRhbG9uZTogdHJ1ZSxcbiAgICBvcGVuOiBzdHJpcC5vcGVuLFxuICAgIGNsb3NlOiBzdHJpcC5jbG9zZVxuICB9O1xufTtcblxuXG5mdW5jdGlvbiBpc1ByZXZXaGl0ZXNwYWNlKGJvZHksIGksIGlzUm9vdCkge1xuICBpZiAoaSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgaSA9IGJvZHkubGVuZ3RoO1xuICB9XG5cbiAgLy8gTm9kZXMgdGhhdCBlbmQgd2l0aCBuZXdsaW5lcyBhcmUgY29uc2lkZXJlZCB3aGl0ZXNwYWNlIChidXQgYXJlIHNwZWNpYWxcbiAgLy8gY2FzZWQgZm9yIHN0cmlwIG9wZXJhdGlvbnMpXG4gIGxldCBwcmV2ID0gYm9keVtpIC0gMV0sXG4gICAgICBzaWJsaW5nID0gYm9keVtpIC0gMl07XG4gIGlmICghcHJldikge1xuICAgIHJldHVybiBpc1Jvb3Q7XG4gIH1cblxuICBpZiAocHJldi50eXBlID09PSAnQ29udGVudFN0YXRlbWVudCcpIHtcbiAgICByZXR1cm4gKHNpYmxpbmcgfHwgIWlzUm9vdCA/ICgvXFxyP1xcblxccyo/JC8pIDogKC8oXnxcXHI/XFxuKVxccyo/JC8pKS50ZXN0KHByZXYub3JpZ2luYWwpO1xuICB9XG59XG5mdW5jdGlvbiBpc05leHRXaGl0ZXNwYWNlKGJvZHksIGksIGlzUm9vdCkge1xuICBpZiAoaSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgaSA9IC0xO1xuICB9XG5cbiAgbGV0IG5leHQgPSBib2R5W2kgKyAxXSxcbiAgICAgIHNpYmxpbmcgPSBib2R5W2kgKyAyXTtcbiAgaWYgKCFuZXh0KSB7XG4gICAgcmV0dXJuIGlzUm9vdDtcbiAgfVxuXG4gIGlmIChuZXh0LnR5cGUgPT09ICdDb250ZW50U3RhdGVtZW50Jykge1xuICAgIHJldHVybiAoc2libGluZyB8fCAhaXNSb290ID8gKC9eXFxzKj9cXHI/XFxuLykgOiAoL15cXHMqPyhcXHI/XFxufCQpLykpLnRlc3QobmV4dC5vcmlnaW5hbCk7XG4gIH1cbn1cblxuLy8gTWFya3MgdGhlIG5vZGUgdG8gdGhlIHJpZ2h0IG9mIHRoZSBwb3NpdGlvbiBhcyBvbWl0dGVkLlxuLy8gSS5lLiB7e2Zvb319JyAnIHdpbGwgbWFyayB0aGUgJyAnIG5vZGUgYXMgb21pdHRlZC5cbi8vXG4vLyBJZiBpIGlzIHVuZGVmaW5lZCwgdGhlbiB0aGUgZmlyc3QgY2hpbGQgd2lsbCBiZSBtYXJrZWQgYXMgc3VjaC5cbi8vXG4vLyBJZiBtdWxpdHBsZSBpcyB0cnV0aHkgdGhlbiBhbGwgd2hpdGVzcGFjZSB3aWxsIGJlIHN0cmlwcGVkIG91dCB1bnRpbCBub24td2hpdGVzcGFjZVxuLy8gY29udGVudCBpcyBtZXQuXG5mdW5jdGlvbiBvbWl0UmlnaHQoYm9keSwgaSwgbXVsdGlwbGUpIHtcbiAgbGV0IGN1cnJlbnQgPSBib2R5W2kgPT0gbnVsbCA/IDAgOiBpICsgMV07XG4gIGlmICghY3VycmVudCB8fCBjdXJyZW50LnR5cGUgIT09ICdDb250ZW50U3RhdGVtZW50JyB8fCAoIW11bHRpcGxlICYmIGN1cnJlbnQucmlnaHRTdHJpcHBlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgb3JpZ2luYWwgPSBjdXJyZW50LnZhbHVlO1xuICBjdXJyZW50LnZhbHVlID0gY3VycmVudC52YWx1ZS5yZXBsYWNlKG11bHRpcGxlID8gKC9eXFxzKy8pIDogKC9eWyBcXHRdKlxccj9cXG4/LyksICcnKTtcbiAgY3VycmVudC5yaWdodFN0cmlwcGVkID0gY3VycmVudC52YWx1ZSAhPT0gb3JpZ2luYWw7XG59XG5cbi8vIE1hcmtzIHRoZSBub2RlIHRvIHRoZSBsZWZ0IG9mIHRoZSBwb3NpdGlvbiBhcyBvbWl0dGVkLlxuLy8gSS5lLiAnICd7e2Zvb319IHdpbGwgbWFyayB0aGUgJyAnIG5vZGUgYXMgb21pdHRlZC5cbi8vXG4vLyBJZiBpIGlzIHVuZGVmaW5lZCB0aGVuIHRoZSBsYXN0IGNoaWxkIHdpbGwgYmUgbWFya2VkIGFzIHN1Y2guXG4vL1xuLy8gSWYgbXVsaXRwbGUgaXMgdHJ1dGh5IHRoZW4gYWxsIHdoaXRlc3BhY2Ugd2lsbCBiZSBzdHJpcHBlZCBvdXQgdW50aWwgbm9uLXdoaXRlc3BhY2Vcbi8vIGNvbnRlbnQgaXMgbWV0LlxuZnVuY3Rpb24gb21pdExlZnQoYm9keSwgaSwgbXVsdGlwbGUpIHtcbiAgbGV0IGN1cnJlbnQgPSBib2R5W2kgPT0gbnVsbCA/IGJvZHkubGVuZ3RoIC0gMSA6IGkgLSAxXTtcbiAgaWYgKCFjdXJyZW50IHx8IGN1cnJlbnQudHlwZSAhPT0gJ0NvbnRlbnRTdGF0ZW1lbnQnIHx8ICghbXVsdGlwbGUgJiYgY3VycmVudC5sZWZ0U3RyaXBwZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gV2Ugb21pdCB0aGUgbGFzdCBub2RlIGlmIGl0J3Mgd2hpdGVzcGFjZSBvbmx5IGFuZCBub3QgcHJlY2VlZGVkIGJ5IGEgbm9uLWNvbnRlbnQgbm9kZS5cbiAgbGV0IG9yaWdpbmFsID0gY3VycmVudC52YWx1ZTtcbiAgY3VycmVudC52YWx1ZSA9IGN1cnJlbnQudmFsdWUucmVwbGFjZShtdWx0aXBsZSA/ICgvXFxzKyQvKSA6ICgvWyBcXHRdKyQvKSwgJycpO1xuICBjdXJyZW50LmxlZnRTdHJpcHBlZCA9IGN1cnJlbnQudmFsdWUgIT09IG9yaWdpbmFsO1xuICByZXR1cm4gY3VycmVudC5sZWZ0U3RyaXBwZWQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IFdoaXRlc3BhY2VDb250cm9sO1xuIiwiaW1wb3J0IHJlZ2lzdGVySW5saW5lIGZyb20gJy4vZGVjb3JhdG9ycy9pbmxpbmUnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJEZWZhdWx0RGVjb3JhdG9ycyhpbnN0YW5jZSkge1xuICByZWdpc3RlcklubGluZShpbnN0YW5jZSk7XG59XG5cbiIsImltcG9ydCB7ZXh0ZW5kfSBmcm9tICcuLi91dGlscyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVyRGVjb3JhdG9yKCdpbmxpbmUnLCBmdW5jdGlvbihmbiwgcHJvcHMsIGNvbnRhaW5lciwgb3B0aW9ucykge1xuICAgIGxldCByZXQgPSBmbjtcbiAgICBpZiAoIXByb3BzLnBhcnRpYWxzKSB7XG4gICAgICBwcm9wcy5wYXJ0aWFscyA9IHt9O1xuICAgICAgcmV0ID0gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgICAgICAvLyBDcmVhdGUgYSBuZXcgcGFydGlhbHMgc3RhY2sgZnJhbWUgcHJpb3IgdG8gZXhlYy5cbiAgICAgICAgbGV0IG9yaWdpbmFsID0gY29udGFpbmVyLnBhcnRpYWxzO1xuICAgICAgICBjb250YWluZXIucGFydGlhbHMgPSBleHRlbmQoe30sIG9yaWdpbmFsLCBwcm9wcy5wYXJ0aWFscyk7XG4gICAgICAgIGxldCByZXQgPSBmbihjb250ZXh0LCBvcHRpb25zKTtcbiAgICAgICAgY29udGFpbmVyLnBhcnRpYWxzID0gb3JpZ2luYWw7XG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHByb3BzLnBhcnRpYWxzW29wdGlvbnMuYXJnc1swXV0gPSBvcHRpb25zLmZuO1xuXG4gICAgcmV0dXJuIHJldDtcbiAgfSk7XG59XG4iLCJcbmNvbnN0IGVycm9yUHJvcHMgPSBbJ2Rlc2NyaXB0aW9uJywgJ2ZpbGVOYW1lJywgJ2xpbmVOdW1iZXInLCAnbWVzc2FnZScsICduYW1lJywgJ251bWJlcicsICdzdGFjayddO1xuXG5mdW5jdGlvbiBFeGNlcHRpb24obWVzc2FnZSwgbm9kZSkge1xuICBsZXQgbG9jID0gbm9kZSAmJiBub2RlLmxvYyxcbiAgICAgIGxpbmUsXG4gICAgICBjb2x1bW47XG4gIGlmIChsb2MpIHtcbiAgICBsaW5lID0gbG9jLnN0YXJ0LmxpbmU7XG4gICAgY29sdW1uID0gbG9jLnN0YXJ0LmNvbHVtbjtcblxuICAgIG1lc3NhZ2UgKz0gJyAtICcgKyBsaW5lICsgJzonICsgY29sdW1uO1xuICB9XG5cbiAgbGV0IHRtcCA9IEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xuXG4gIC8vIFVuZm9ydHVuYXRlbHkgZXJyb3JzIGFyZSBub3QgZW51bWVyYWJsZSBpbiBDaHJvbWUgKGF0IGxlYXN0KSwgc28gYGZvciBwcm9wIGluIHRtcGAgZG9lc24ndCB3b3JrLlxuICBmb3IgKGxldCBpZHggPSAwOyBpZHggPCBlcnJvclByb3BzLmxlbmd0aDsgaWR4KyspIHtcbiAgICB0aGlzW2Vycm9yUHJvcHNbaWR4XV0gPSB0bXBbZXJyb3JQcm9wc1tpZHhdXTtcbiAgfVxuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gIGlmIChFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIEV4Y2VwdGlvbik7XG4gIH1cblxuICB0cnkge1xuICAgIGlmIChsb2MpIHtcbiAgICAgIHRoaXMubGluZU51bWJlciA9IGxpbmU7XG5cbiAgICAgIC8vIFdvcmsgYXJvdW5kIGlzc3VlIHVuZGVyIHNhZmFyaSB3aGVyZSB3ZSBjYW4ndCBkaXJlY3RseSBzZXQgdGhlIGNvbHVtbiB2YWx1ZVxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdjb2x1bW4nLCB7XG4gICAgICAgICAgdmFsdWU6IGNvbHVtbixcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jb2x1bW4gPSBjb2x1bW47XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChub3ApIHtcbiAgICAvKiBJZ25vcmUgaWYgdGhlIGJyb3dzZXIgaXMgdmVyeSBwYXJ0aWN1bGFyICovXG4gIH1cbn1cblxuRXhjZXB0aW9uLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuXG5leHBvcnQgZGVmYXVsdCBFeGNlcHRpb247XG4iLCJpbXBvcnQgcmVnaXN0ZXJCbG9ja0hlbHBlck1pc3NpbmcgZnJvbSAnLi9oZWxwZXJzL2Jsb2NrLWhlbHBlci1taXNzaW5nJztcbmltcG9ydCByZWdpc3RlckVhY2ggZnJvbSAnLi9oZWxwZXJzL2VhY2gnO1xuaW1wb3J0IHJlZ2lzdGVySGVscGVyTWlzc2luZyBmcm9tICcuL2hlbHBlcnMvaGVscGVyLW1pc3NpbmcnO1xuaW1wb3J0IHJlZ2lzdGVySWYgZnJvbSAnLi9oZWxwZXJzL2lmJztcbmltcG9ydCByZWdpc3RlckxvZyBmcm9tICcuL2hlbHBlcnMvbG9nJztcbmltcG9ydCByZWdpc3Rlckxvb2t1cCBmcm9tICcuL2hlbHBlcnMvbG9va3VwJztcbmltcG9ydCByZWdpc3RlcldpdGggZnJvbSAnLi9oZWxwZXJzL3dpdGgnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJEZWZhdWx0SGVscGVycyhpbnN0YW5jZSkge1xuICByZWdpc3RlckJsb2NrSGVscGVyTWlzc2luZyhpbnN0YW5jZSk7XG4gIHJlZ2lzdGVyRWFjaChpbnN0YW5jZSk7XG4gIHJlZ2lzdGVySGVscGVyTWlzc2luZyhpbnN0YW5jZSk7XG4gIHJlZ2lzdGVySWYoaW5zdGFuY2UpO1xuICByZWdpc3RlckxvZyhpbnN0YW5jZSk7XG4gIHJlZ2lzdGVyTG9va3VwKGluc3RhbmNlKTtcbiAgcmVnaXN0ZXJXaXRoKGluc3RhbmNlKTtcbn1cbiIsImltcG9ydCB7YXBwZW5kQ29udGV4dFBhdGgsIGNyZWF0ZUZyYW1lLCBpc0FycmF5fSBmcm9tICcuLi91dGlscyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdibG9ja0hlbHBlck1pc3NpbmcnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgbGV0IGludmVyc2UgPSBvcHRpb25zLmludmVyc2UsXG4gICAgICAgIGZuID0gb3B0aW9ucy5mbjtcblxuICAgIGlmIChjb250ZXh0ID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gZm4odGhpcyk7XG4gICAgfSBlbHNlIGlmIChjb250ZXh0ID09PSBmYWxzZSB8fCBjb250ZXh0ID09IG51bGwpIHtcbiAgICAgIHJldHVybiBpbnZlcnNlKHRoaXMpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjb250ZXh0KSkge1xuICAgICAgaWYgKGNvbnRleHQubGVuZ3RoID4gMCkge1xuICAgICAgICBpZiAob3B0aW9ucy5pZHMpIHtcbiAgICAgICAgICBvcHRpb25zLmlkcyA9IFtvcHRpb25zLm5hbWVdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnMuZWFjaChjb250ZXh0LCBvcHRpb25zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBpbnZlcnNlKHRoaXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3B0aW9ucy5kYXRhICYmIG9wdGlvbnMuaWRzKSB7XG4gICAgICAgIGxldCBkYXRhID0gY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgICAgICAgZGF0YS5jb250ZXh0UGF0aCA9IGFwcGVuZENvbnRleHRQYXRoKG9wdGlvbnMuZGF0YS5jb250ZXh0UGF0aCwgb3B0aW9ucy5uYW1lKTtcbiAgICAgICAgb3B0aW9ucyA9IHtkYXRhOiBkYXRhfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZuKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIH1cbiAgfSk7XG59XG4iLCJpbXBvcnQge2FwcGVuZENvbnRleHRQYXRoLCBibG9ja1BhcmFtcywgY3JlYXRlRnJhbWUsIGlzQXJyYXksIGlzRnVuY3Rpb259IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCBFeGNlcHRpb24gZnJvbSAnLi4vZXhjZXB0aW9uJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2VhY2gnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdNdXN0IHBhc3MgaXRlcmF0b3IgdG8gI2VhY2gnKTtcbiAgICB9XG5cbiAgICBsZXQgZm4gPSBvcHRpb25zLmZuLFxuICAgICAgICBpbnZlcnNlID0gb3B0aW9ucy5pbnZlcnNlLFxuICAgICAgICBpID0gMCxcbiAgICAgICAgcmV0ID0gJycsXG4gICAgICAgIGRhdGEsXG4gICAgICAgIGNvbnRleHRQYXRoO1xuXG4gICAgaWYgKG9wdGlvbnMuZGF0YSAmJiBvcHRpb25zLmlkcykge1xuICAgICAgY29udGV4dFBhdGggPSBhcHBlbmRDb250ZXh0UGF0aChvcHRpb25zLmRhdGEuY29udGV4dFBhdGgsIG9wdGlvbnMuaWRzWzBdKSArICcuJztcbiAgICB9XG5cbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBpZiAob3B0aW9ucy5kYXRhKSB7XG4gICAgICBkYXRhID0gY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGVjSXRlcmF0aW9uKGZpZWxkLCBpbmRleCwgbGFzdCkge1xuICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgZGF0YS5rZXkgPSBmaWVsZDtcbiAgICAgICAgZGF0YS5pbmRleCA9IGluZGV4O1xuICAgICAgICBkYXRhLmZpcnN0ID0gaW5kZXggPT09IDA7XG4gICAgICAgIGRhdGEubGFzdCA9ICEhbGFzdDtcblxuICAgICAgICBpZiAoY29udGV4dFBhdGgpIHtcbiAgICAgICAgICBkYXRhLmNvbnRleHRQYXRoID0gY29udGV4dFBhdGggKyBmaWVsZDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXQgPSByZXQgKyBmbihjb250ZXh0W2ZpZWxkXSwge1xuICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICBibG9ja1BhcmFtczogYmxvY2tQYXJhbXMoW2NvbnRleHRbZmllbGRdLCBmaWVsZF0sIFtjb250ZXh0UGF0aCArIGZpZWxkLCBudWxsXSlcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChjb250ZXh0ICYmIHR5cGVvZiBjb250ZXh0ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGlzQXJyYXkoY29udGV4dCkpIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IGNvbnRleHQubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgICAgaWYgKGkgaW4gY29udGV4dCkge1xuICAgICAgICAgICAgZXhlY0l0ZXJhdGlvbihpLCBpLCBpID09PSBjb250ZXh0Lmxlbmd0aCAtIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHByaW9yS2V5O1xuXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBjb250ZXh0KSB7XG4gICAgICAgICAgaWYgKGNvbnRleHQuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgLy8gV2UncmUgcnVubmluZyB0aGUgaXRlcmF0aW9ucyBvbmUgc3RlcCBvdXQgb2Ygc3luYyBzbyB3ZSBjYW4gZGV0ZWN0XG4gICAgICAgICAgICAvLyB0aGUgbGFzdCBpdGVyYXRpb24gd2l0aG91dCBoYXZlIHRvIHNjYW4gdGhlIG9iamVjdCB0d2ljZSBhbmQgY3JlYXRlXG4gICAgICAgICAgICAvLyBhbiBpdGVybWVkaWF0ZSBrZXlzIGFycmF5LlxuICAgICAgICAgICAgaWYgKHByaW9yS2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgZXhlY0l0ZXJhdGlvbihwcmlvcktleSwgaSAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJpb3JLZXkgPSBrZXk7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChwcmlvcktleSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZXhlY0l0ZXJhdGlvbihwcmlvcktleSwgaSAtIDEsIHRydWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGkgPT09IDApIHtcbiAgICAgIHJldCA9IGludmVyc2UodGhpcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbiAgfSk7XG59XG4iLCJpbXBvcnQgRXhjZXB0aW9uIGZyb20gJy4uL2V4Y2VwdGlvbic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdoZWxwZXJNaXNzaW5nJywgZnVuY3Rpb24oLyogW2FyZ3MsIF1vcHRpb25zICovKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIEEgbWlzc2luZyBmaWVsZCBpbiBhIHt7Zm9vfX0gY29uc3RydWN0LlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU29tZW9uZSBpcyBhY3R1YWxseSB0cnlpbmcgdG8gY2FsbCBzb21ldGhpbmcsIGJsb3cgdXAuXG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdNaXNzaW5nIGhlbHBlcjogXCInICsgYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXS5uYW1lICsgJ1wiJyk7XG4gICAgfVxuICB9KTtcbn1cbiIsImltcG9ydCB7aXNFbXB0eSwgaXNGdW5jdGlvbn0gZnJvbSAnLi4vdXRpbHMnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihpbnN0YW5jZSkge1xuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignaWYnLCBmdW5jdGlvbihjb25kaXRpb25hbCwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNvbmRpdGlvbmFsKSkgeyBjb25kaXRpb25hbCA9IGNvbmRpdGlvbmFsLmNhbGwodGhpcyk7IH1cblxuICAgIC8vIERlZmF1bHQgYmVoYXZpb3IgaXMgdG8gcmVuZGVyIHRoZSBwb3NpdGl2ZSBwYXRoIGlmIHRoZSB2YWx1ZSBpcyB0cnV0aHkgYW5kIG5vdCBlbXB0eS5cbiAgICAvLyBUaGUgYGluY2x1ZGVaZXJvYCBvcHRpb24gbWF5IGJlIHNldCB0byB0cmVhdCB0aGUgY29uZHRpb25hbCBhcyBwdXJlbHkgbm90IGVtcHR5IGJhc2VkIG9uIHRoZVxuICAgIC8vIGJlaGF2aW9yIG9mIGlzRW1wdHkuIEVmZmVjdGl2ZWx5IHRoaXMgZGV0ZXJtaW5lcyBpZiAwIGlzIGhhbmRsZWQgYnkgdGhlIHBvc2l0aXZlIHBhdGggb3IgbmVnYXRpdmUuXG4gICAgaWYgKCghb3B0aW9ucy5oYXNoLmluY2x1ZGVaZXJvICYmICFjb25kaXRpb25hbCkgfHwgaXNFbXB0eShjb25kaXRpb25hbCkpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmludmVyc2UodGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmZuKHRoaXMpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ3VubGVzcycsIGZ1bmN0aW9uKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnNbJ2lmJ10uY2FsbCh0aGlzLCBjb25kaXRpb25hbCwge2ZuOiBvcHRpb25zLmludmVyc2UsIGludmVyc2U6IG9wdGlvbnMuZm4sIGhhc2g6IG9wdGlvbnMuaGFzaH0pO1xuICB9KTtcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdsb2cnLCBmdW5jdGlvbigvKiBtZXNzYWdlLCBvcHRpb25zICovKSB7XG4gICAgbGV0IGFyZ3MgPSBbdW5kZWZpbmVkXSxcbiAgICAgICAgb3B0aW9ucyA9IGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBhcmdzLnB1c2goYXJndW1lbnRzW2ldKTtcbiAgICB9XG5cbiAgICBsZXQgbGV2ZWwgPSAxO1xuICAgIGlmIChvcHRpb25zLmhhc2gubGV2ZWwgIT0gbnVsbCkge1xuICAgICAgbGV2ZWwgPSBvcHRpb25zLmhhc2gubGV2ZWw7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmRhdGEgJiYgb3B0aW9ucy5kYXRhLmxldmVsICE9IG51bGwpIHtcbiAgICAgIGxldmVsID0gb3B0aW9ucy5kYXRhLmxldmVsO1xuICAgIH1cbiAgICBhcmdzWzBdID0gbGV2ZWw7XG5cbiAgICBpbnN0YW5jZS5sb2coLi4uIGFyZ3MpO1xuICB9KTtcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdsb29rdXAnLCBmdW5jdGlvbihvYmosIGZpZWxkKSB7XG4gICAgcmV0dXJuIG9iaiAmJiBvYmpbZmllbGRdO1xuICB9KTtcbn1cbiIsImltcG9ydCB7YXBwZW5kQ29udGV4dFBhdGgsIGJsb2NrUGFyYW1zLCBjcmVhdGVGcmFtZSwgaXNFbXB0eSwgaXNGdW5jdGlvbn0gZnJvbSAnLi4vdXRpbHMnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihpbnN0YW5jZSkge1xuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignd2l0aCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBsZXQgZm4gPSBvcHRpb25zLmZuO1xuXG4gICAgaWYgKCFpc0VtcHR5KGNvbnRleHQpKSB7XG4gICAgICBsZXQgZGF0YSA9IG9wdGlvbnMuZGF0YTtcbiAgICAgIGlmIChvcHRpb25zLmRhdGEgJiYgb3B0aW9ucy5pZHMpIHtcbiAgICAgICAgZGF0YSA9IGNyZWF0ZUZyYW1lKG9wdGlvbnMuZGF0YSk7XG4gICAgICAgIGRhdGEuY29udGV4dFBhdGggPSBhcHBlbmRDb250ZXh0UGF0aChvcHRpb25zLmRhdGEuY29udGV4dFBhdGgsIG9wdGlvbnMuaWRzWzBdKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZuKGNvbnRleHQsIHtcbiAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgYmxvY2tQYXJhbXM6IGJsb2NrUGFyYW1zKFtjb250ZXh0XSwgW2RhdGEgJiYgZGF0YS5jb250ZXh0UGF0aF0pXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuaW52ZXJzZSh0aGlzKTtcbiAgICB9XG4gIH0pO1xufVxuIiwiaW1wb3J0IHtpbmRleE9mfSBmcm9tICcuL3V0aWxzJztcblxubGV0IGxvZ2dlciA9IHtcbiAgbWV0aG9kTWFwOiBbJ2RlYnVnJywgJ2luZm8nLCAnd2FybicsICdlcnJvciddLFxuICBsZXZlbDogJ2luZm8nLFxuXG4gIC8vIE1hcHMgYSBnaXZlbiBsZXZlbCB2YWx1ZSB0byB0aGUgYG1ldGhvZE1hcGAgaW5kZXhlcyBhYm92ZS5cbiAgbG9va3VwTGV2ZWw6IGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgaWYgKHR5cGVvZiBsZXZlbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGxldCBsZXZlbE1hcCA9IGluZGV4T2YobG9nZ2VyLm1ldGhvZE1hcCwgbGV2ZWwudG9Mb3dlckNhc2UoKSk7XG4gICAgICBpZiAobGV2ZWxNYXAgPj0gMCkge1xuICAgICAgICBsZXZlbCA9IGxldmVsTWFwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWwgPSBwYXJzZUludChsZXZlbCwgMTApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsZXZlbDtcbiAgfSxcblxuICAvLyBDYW4gYmUgb3ZlcnJpZGRlbiBpbiB0aGUgaG9zdCBlbnZpcm9ubWVudFxuICBsb2c6IGZ1bmN0aW9uKGxldmVsLCAuLi5tZXNzYWdlKSB7XG4gICAgbGV2ZWwgPSBsb2dnZXIubG9va3VwTGV2ZWwobGV2ZWwpO1xuXG4gICAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJiBsb2dnZXIubG9va3VwTGV2ZWwobG9nZ2VyLmxldmVsKSA8PSBsZXZlbCkge1xuICAgICAgbGV0IG1ldGhvZCA9IGxvZ2dlci5tZXRob2RNYXBbbGV2ZWxdO1xuICAgICAgaWYgKCFjb25zb2xlW21ldGhvZF0pIHsgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWNvbnNvbGVcbiAgICAgICAgbWV0aG9kID0gJ2xvZyc7XG4gICAgICB9XG4gICAgICBjb25zb2xlW21ldGhvZF0oLi4ubWVzc2FnZSk7ICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tY29uc29sZVxuICAgIH1cbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgbG9nZ2VyO1xuIiwiLyogZ2xvYmFsIHdpbmRvdyAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oSGFuZGxlYmFycykge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBsZXQgcm9vdCA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDogd2luZG93LFxuICAgICAgJEhhbmRsZWJhcnMgPSByb290LkhhbmRsZWJhcnM7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIEhhbmRsZWJhcnMubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChyb290LkhhbmRsZWJhcnMgPT09IEhhbmRsZWJhcnMpIHtcbiAgICAgIHJvb3QuSGFuZGxlYmFycyA9ICRIYW5kbGViYXJzO1xuICAgIH1cbiAgICByZXR1cm4gSGFuZGxlYmFycztcbiAgfTtcbn1cbiIsImltcG9ydCAqIGFzIFV0aWxzIGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IEV4Y2VwdGlvbiBmcm9tICcuL2V4Y2VwdGlvbic7XG5pbXBvcnQgeyBDT01QSUxFUl9SRVZJU0lPTiwgUkVWSVNJT05fQ0hBTkdFUywgY3JlYXRlRnJhbWUgfSBmcm9tICcuL2Jhc2UnO1xuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tSZXZpc2lvbihjb21waWxlckluZm8pIHtcbiAgY29uc3QgY29tcGlsZXJSZXZpc2lvbiA9IGNvbXBpbGVySW5mbyAmJiBjb21waWxlckluZm9bMF0gfHwgMSxcbiAgICAgICAgY3VycmVudFJldmlzaW9uID0gQ09NUElMRVJfUkVWSVNJT047XG5cbiAgaWYgKGNvbXBpbGVyUmV2aXNpb24gIT09IGN1cnJlbnRSZXZpc2lvbikge1xuICAgIGlmIChjb21waWxlclJldmlzaW9uIDwgY3VycmVudFJldmlzaW9uKSB7XG4gICAgICBjb25zdCBydW50aW1lVmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW2N1cnJlbnRSZXZpc2lvbl0sXG4gICAgICAgICAgICBjb21waWxlclZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tjb21waWxlclJldmlzaW9uXTtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ1RlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGFuIG9sZGVyIHZlcnNpb24gb2YgSGFuZGxlYmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuICcgK1xuICAgICAgICAgICAgJ1BsZWFzZSB1cGRhdGUgeW91ciBwcmVjb21waWxlciB0byBhIG5ld2VyIHZlcnNpb24gKCcgKyBydW50aW1lVmVyc2lvbnMgKyAnKSBvciBkb3duZ3JhZGUgeW91ciBydW50aW1lIHRvIGFuIG9sZGVyIHZlcnNpb24gKCcgKyBjb21waWxlclZlcnNpb25zICsgJykuJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSB0aGUgZW1iZWRkZWQgdmVyc2lvbiBpbmZvIHNpbmNlIHRoZSBydW50aW1lIGRvZXNuJ3Qga25vdyBhYm91dCB0aGlzIHJldmlzaW9uIHlldFxuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignVGVtcGxhdGUgd2FzIHByZWNvbXBpbGVkIHdpdGggYSBuZXdlciB2ZXJzaW9uIG9mIEhhbmRsZWJhcnMgdGhhbiB0aGUgY3VycmVudCBydW50aW1lLiAnICtcbiAgICAgICAgICAgICdQbGVhc2UgdXBkYXRlIHlvdXIgcnVudGltZSB0byBhIG5ld2VyIHZlcnNpb24gKCcgKyBjb21waWxlckluZm9bMV0gKyAnKS4nKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlKHRlbXBsYXRlU3BlYywgZW52KSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIGlmICghZW52KSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignTm8gZW52aXJvbm1lbnQgcGFzc2VkIHRvIHRlbXBsYXRlJyk7XG4gIH1cbiAgaWYgKCF0ZW1wbGF0ZVNwZWMgfHwgIXRlbXBsYXRlU3BlYy5tYWluKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignVW5rbm93biB0ZW1wbGF0ZSBvYmplY3Q6ICcgKyB0eXBlb2YgdGVtcGxhdGVTcGVjKTtcbiAgfVxuXG4gIHRlbXBsYXRlU3BlYy5tYWluLmRlY29yYXRvciA9IHRlbXBsYXRlU3BlYy5tYWluX2Q7XG5cbiAgLy8gTm90ZTogVXNpbmcgZW52LlZNIHJlZmVyZW5jZXMgcmF0aGVyIHRoYW4gbG9jYWwgdmFyIHJlZmVyZW5jZXMgdGhyb3VnaG91dCB0aGlzIHNlY3Rpb24gdG8gYWxsb3dcbiAgLy8gZm9yIGV4dGVybmFsIHVzZXJzIHRvIG92ZXJyaWRlIHRoZXNlIGFzIHBzdWVkby1zdXBwb3J0ZWQgQVBJcy5cbiAgZW52LlZNLmNoZWNrUmV2aXNpb24odGVtcGxhdGVTcGVjLmNvbXBpbGVyKTtcblxuICBmdW5jdGlvbiBpbnZva2VQYXJ0aWFsV3JhcHBlcihwYXJ0aWFsLCBjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuaGFzaCkge1xuICAgICAgY29udGV4dCA9IFV0aWxzLmV4dGVuZCh7fSwgY29udGV4dCwgb3B0aW9ucy5oYXNoKTtcbiAgICAgIGlmIChvcHRpb25zLmlkcykge1xuICAgICAgICBvcHRpb25zLmlkc1swXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcGFydGlhbCA9IGVudi5WTS5yZXNvbHZlUGFydGlhbC5jYWxsKHRoaXMsIHBhcnRpYWwsIGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIGxldCByZXN1bHQgPSBlbnYuVk0uaW52b2tlUGFydGlhbC5jYWxsKHRoaXMsIHBhcnRpYWwsIGNvbnRleHQsIG9wdGlvbnMpO1xuXG4gICAgaWYgKHJlc3VsdCA9PSBudWxsICYmIGVudi5jb21waWxlKSB7XG4gICAgICBvcHRpb25zLnBhcnRpYWxzW29wdGlvbnMubmFtZV0gPSBlbnYuY29tcGlsZShwYXJ0aWFsLCB0ZW1wbGF0ZVNwZWMuY29tcGlsZXJPcHRpb25zLCBlbnYpO1xuICAgICAgcmVzdWx0ID0gb3B0aW9ucy5wYXJ0aWFsc1tvcHRpb25zLm5hbWVdKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0ICE9IG51bGwpIHtcbiAgICAgIGlmIChvcHRpb25zLmluZGVudCkge1xuICAgICAgICBsZXQgbGluZXMgPSByZXN1bHQuc3BsaXQoJ1xcbicpO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxpbmVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgIGlmICghbGluZXNbaV0gJiYgaSArIDEgPT09IGwpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpbmVzW2ldID0gb3B0aW9ucy5pbmRlbnQgKyBsaW5lc1tpXTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSBsaW5lcy5qb2luKCdcXG4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ1RoZSBwYXJ0aWFsICcgKyBvcHRpb25zLm5hbWUgKyAnIGNvdWxkIG5vdCBiZSBjb21waWxlZCB3aGVuIHJ1bm5pbmcgaW4gcnVudGltZS1vbmx5IG1vZGUnKTtcbiAgICB9XG4gIH1cblxuICAvLyBKdXN0IGFkZCB3YXRlclxuICBsZXQgY29udGFpbmVyID0ge1xuICAgIHN0cmljdDogZnVuY3Rpb24ob2JqLCBuYW1lKSB7XG4gICAgICBpZiAoIShuYW1lIGluIG9iaikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignXCInICsgbmFtZSArICdcIiBub3QgZGVmaW5lZCBpbiAnICsgb2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmpbbmFtZV07XG4gICAgfSxcbiAgICBsb29rdXA6IGZ1bmN0aW9uKGRlcHRocywgbmFtZSkge1xuICAgICAgY29uc3QgbGVuID0gZGVwdGhzLmxlbmd0aDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgaWYgKGRlcHRoc1tpXSAmJiBkZXB0aHNbaV1bbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBkZXB0aHNbaV1bbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGxhbWJkYTogZnVuY3Rpb24oY3VycmVudCwgY29udGV4dCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiBjdXJyZW50ID09PSAnZnVuY3Rpb24nID8gY3VycmVudC5jYWxsKGNvbnRleHQpIDogY3VycmVudDtcbiAgICB9LFxuXG4gICAgZXNjYXBlRXhwcmVzc2lvbjogVXRpbHMuZXNjYXBlRXhwcmVzc2lvbixcbiAgICBpbnZva2VQYXJ0aWFsOiBpbnZva2VQYXJ0aWFsV3JhcHBlcixcblxuICAgIGZuOiBmdW5jdGlvbihpKSB7XG4gICAgICBsZXQgcmV0ID0gdGVtcGxhdGVTcGVjW2ldO1xuICAgICAgcmV0LmRlY29yYXRvciA9IHRlbXBsYXRlU3BlY1tpICsgJ19kJ107XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG5cbiAgICBwcm9ncmFtczogW10sXG4gICAgcHJvZ3JhbTogZnVuY3Rpb24oaSwgZGF0YSwgZGVjbGFyZWRCbG9ja1BhcmFtcywgYmxvY2tQYXJhbXMsIGRlcHRocykge1xuICAgICAgbGV0IHByb2dyYW1XcmFwcGVyID0gdGhpcy5wcm9ncmFtc1tpXSxcbiAgICAgICAgICBmbiA9IHRoaXMuZm4oaSk7XG4gICAgICBpZiAoZGF0YSB8fCBkZXB0aHMgfHwgYmxvY2tQYXJhbXMgfHwgZGVjbGFyZWRCbG9ja1BhcmFtcykge1xuICAgICAgICBwcm9ncmFtV3JhcHBlciA9IHdyYXBQcm9ncmFtKHRoaXMsIGksIGZuLCBkYXRhLCBkZWNsYXJlZEJsb2NrUGFyYW1zLCBibG9ja1BhcmFtcywgZGVwdGhzKTtcbiAgICAgIH0gZWxzZSBpZiAoIXByb2dyYW1XcmFwcGVyKSB7XG4gICAgICAgIHByb2dyYW1XcmFwcGVyID0gdGhpcy5wcm9ncmFtc1tpXSA9IHdyYXBQcm9ncmFtKHRoaXMsIGksIGZuKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwcm9ncmFtV3JhcHBlcjtcbiAgICB9LFxuXG4gICAgZGF0YTogZnVuY3Rpb24odmFsdWUsIGRlcHRoKSB7XG4gICAgICB3aGlsZSAodmFsdWUgJiYgZGVwdGgtLSkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLl9wYXJlbnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSxcbiAgICBtZXJnZTogZnVuY3Rpb24ocGFyYW0sIGNvbW1vbikge1xuICAgICAgbGV0IG9iaiA9IHBhcmFtIHx8IGNvbW1vbjtcblxuICAgICAgaWYgKHBhcmFtICYmIGNvbW1vbiAmJiAocGFyYW0gIT09IGNvbW1vbikpIHtcbiAgICAgICAgb2JqID0gVXRpbHMuZXh0ZW5kKHt9LCBjb21tb24sIHBhcmFtKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG9iajtcbiAgICB9LFxuICAgIC8vIEFuIGVtcHR5IG9iamVjdCB0byB1c2UgYXMgcmVwbGFjZW1lbnQgZm9yIG51bGwtY29udGV4dHNcbiAgICBudWxsQ29udGV4dDogT2JqZWN0LnNlYWwoe30pLFxuXG4gICAgbm9vcDogZW52LlZNLm5vb3AsXG4gICAgY29tcGlsZXJJbmZvOiB0ZW1wbGF0ZVNwZWMuY29tcGlsZXJcbiAgfTtcblxuICBmdW5jdGlvbiByZXQoY29udGV4dCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGRhdGEgPSBvcHRpb25zLmRhdGE7XG5cbiAgICByZXQuX3NldHVwKG9wdGlvbnMpO1xuICAgIGlmICghb3B0aW9ucy5wYXJ0aWFsICYmIHRlbXBsYXRlU3BlYy51c2VEYXRhKSB7XG4gICAgICBkYXRhID0gaW5pdERhdGEoY29udGV4dCwgZGF0YSk7XG4gICAgfVxuICAgIGxldCBkZXB0aHMsXG4gICAgICAgIGJsb2NrUGFyYW1zID0gdGVtcGxhdGVTcGVjLnVzZUJsb2NrUGFyYW1zID8gW10gOiB1bmRlZmluZWQ7XG4gICAgaWYgKHRlbXBsYXRlU3BlYy51c2VEZXB0aHMpIHtcbiAgICAgIGlmIChvcHRpb25zLmRlcHRocykge1xuICAgICAgICBkZXB0aHMgPSBjb250ZXh0ICE9IG9wdGlvbnMuZGVwdGhzWzBdID8gW2NvbnRleHRdLmNvbmNhdChvcHRpb25zLmRlcHRocykgOiBvcHRpb25zLmRlcHRocztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlcHRocyA9IFtjb250ZXh0XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYWluKGNvbnRleHQvKiwgb3B0aW9ucyovKSB7XG4gICAgICByZXR1cm4gJycgKyB0ZW1wbGF0ZVNwZWMubWFpbihjb250YWluZXIsIGNvbnRleHQsIGNvbnRhaW5lci5oZWxwZXJzLCBjb250YWluZXIucGFydGlhbHMsIGRhdGEsIGJsb2NrUGFyYW1zLCBkZXB0aHMpO1xuICAgIH1cbiAgICBtYWluID0gZXhlY3V0ZURlY29yYXRvcnModGVtcGxhdGVTcGVjLm1haW4sIG1haW4sIGNvbnRhaW5lciwgb3B0aW9ucy5kZXB0aHMgfHwgW10sIGRhdGEsIGJsb2NrUGFyYW1zKTtcbiAgICByZXR1cm4gbWFpbihjb250ZXh0LCBvcHRpb25zKTtcbiAgfVxuICByZXQuaXNUb3AgPSB0cnVlO1xuXG4gIHJldC5fc2V0dXAgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLnBhcnRpYWwpIHtcbiAgICAgIGNvbnRhaW5lci5oZWxwZXJzID0gY29udGFpbmVyLm1lcmdlKG9wdGlvbnMuaGVscGVycywgZW52LmhlbHBlcnMpO1xuXG4gICAgICBpZiAodGVtcGxhdGVTcGVjLnVzZVBhcnRpYWwpIHtcbiAgICAgICAgY29udGFpbmVyLnBhcnRpYWxzID0gY29udGFpbmVyLm1lcmdlKG9wdGlvbnMucGFydGlhbHMsIGVudi5wYXJ0aWFscyk7XG4gICAgICB9XG4gICAgICBpZiAodGVtcGxhdGVTcGVjLnVzZVBhcnRpYWwgfHwgdGVtcGxhdGVTcGVjLnVzZURlY29yYXRvcnMpIHtcbiAgICAgICAgY29udGFpbmVyLmRlY29yYXRvcnMgPSBjb250YWluZXIubWVyZ2Uob3B0aW9ucy5kZWNvcmF0b3JzLCBlbnYuZGVjb3JhdG9ycyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRhaW5lci5oZWxwZXJzID0gb3B0aW9ucy5oZWxwZXJzO1xuICAgICAgY29udGFpbmVyLnBhcnRpYWxzID0gb3B0aW9ucy5wYXJ0aWFscztcbiAgICAgIGNvbnRhaW5lci5kZWNvcmF0b3JzID0gb3B0aW9ucy5kZWNvcmF0b3JzO1xuICAgIH1cbiAgfTtcblxuICByZXQuX2NoaWxkID0gZnVuY3Rpb24oaSwgZGF0YSwgYmxvY2tQYXJhbXMsIGRlcHRocykge1xuICAgIGlmICh0ZW1wbGF0ZVNwZWMudXNlQmxvY2tQYXJhbXMgJiYgIWJsb2NrUGFyYW1zKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdtdXN0IHBhc3MgYmxvY2sgcGFyYW1zJyk7XG4gICAgfVxuICAgIGlmICh0ZW1wbGF0ZVNwZWMudXNlRGVwdGhzICYmICFkZXB0aHMpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ211c3QgcGFzcyBwYXJlbnQgZGVwdGhzJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdyYXBQcm9ncmFtKGNvbnRhaW5lciwgaSwgdGVtcGxhdGVTcGVjW2ldLCBkYXRhLCAwLCBibG9ja1BhcmFtcywgZGVwdGhzKTtcbiAgfTtcbiAgcmV0dXJuIHJldDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBQcm9ncmFtKGNvbnRhaW5lciwgaSwgZm4sIGRhdGEsIGRlY2xhcmVkQmxvY2tQYXJhbXMsIGJsb2NrUGFyYW1zLCBkZXB0aHMpIHtcbiAgZnVuY3Rpb24gcHJvZyhjb250ZXh0LCBvcHRpb25zID0ge30pIHtcbiAgICBsZXQgY3VycmVudERlcHRocyA9IGRlcHRocztcbiAgICBpZiAoZGVwdGhzICYmIGNvbnRleHQgIT0gZGVwdGhzWzBdICYmICEoY29udGV4dCA9PT0gY29udGFpbmVyLm51bGxDb250ZXh0ICYmIGRlcHRoc1swXSA9PT0gbnVsbCkpIHtcbiAgICAgIGN1cnJlbnREZXB0aHMgPSBbY29udGV4dF0uY29uY2F0KGRlcHRocyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZuKGNvbnRhaW5lcixcbiAgICAgICAgY29udGV4dCxcbiAgICAgICAgY29udGFpbmVyLmhlbHBlcnMsIGNvbnRhaW5lci5wYXJ0aWFscyxcbiAgICAgICAgb3B0aW9ucy5kYXRhIHx8IGRhdGEsXG4gICAgICAgIGJsb2NrUGFyYW1zICYmIFtvcHRpb25zLmJsb2NrUGFyYW1zXS5jb25jYXQoYmxvY2tQYXJhbXMpLFxuICAgICAgICBjdXJyZW50RGVwdGhzKTtcbiAgfVxuXG4gIHByb2cgPSBleGVjdXRlRGVjb3JhdG9ycyhmbiwgcHJvZywgY29udGFpbmVyLCBkZXB0aHMsIGRhdGEsIGJsb2NrUGFyYW1zKTtcblxuICBwcm9nLnByb2dyYW0gPSBpO1xuICBwcm9nLmRlcHRoID0gZGVwdGhzID8gZGVwdGhzLmxlbmd0aCA6IDA7XG4gIHByb2cuYmxvY2tQYXJhbXMgPSBkZWNsYXJlZEJsb2NrUGFyYW1zIHx8IDA7XG4gIHJldHVybiBwcm9nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVBhcnRpYWwocGFydGlhbCwgY29udGV4dCwgb3B0aW9ucykge1xuICBpZiAoIXBhcnRpYWwpIHtcbiAgICBpZiAob3B0aW9ucy5uYW1lID09PSAnQHBhcnRpYWwtYmxvY2snKSB7XG4gICAgICBwYXJ0aWFsID0gb3B0aW9ucy5kYXRhWydwYXJ0aWFsLWJsb2NrJ107XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcnRpYWwgPSBvcHRpb25zLnBhcnRpYWxzW29wdGlvbnMubmFtZV07XG4gICAgfVxuICB9IGVsc2UgaWYgKCFwYXJ0aWFsLmNhbGwgJiYgIW9wdGlvbnMubmFtZSkge1xuICAgIC8vIFRoaXMgaXMgYSBkeW5hbWljIHBhcnRpYWwgdGhhdCByZXR1cm5lZCBhIHN0cmluZ1xuICAgIG9wdGlvbnMubmFtZSA9IHBhcnRpYWw7XG4gICAgcGFydGlhbCA9IG9wdGlvbnMucGFydGlhbHNbcGFydGlhbF07XG4gIH1cbiAgcmV0dXJuIHBhcnRpYWw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnZva2VQYXJ0aWFsKHBhcnRpYWwsIGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgLy8gVXNlIHRoZSBjdXJyZW50IGNsb3N1cmUgY29udGV4dCB0byBzYXZlIHRoZSBwYXJ0aWFsLWJsb2NrIGlmIHRoaXMgcGFydGlhbFxuICBjb25zdCBjdXJyZW50UGFydGlhbEJsb2NrID0gb3B0aW9ucy5kYXRhICYmIG9wdGlvbnMuZGF0YVsncGFydGlhbC1ibG9jayddO1xuICBvcHRpb25zLnBhcnRpYWwgPSB0cnVlO1xuICBpZiAob3B0aW9ucy5pZHMpIHtcbiAgICBvcHRpb25zLmRhdGEuY29udGV4dFBhdGggPSBvcHRpb25zLmlkc1swXSB8fCBvcHRpb25zLmRhdGEuY29udGV4dFBhdGg7XG4gIH1cblxuICBsZXQgcGFydGlhbEJsb2NrO1xuICBpZiAob3B0aW9ucy5mbiAmJiBvcHRpb25zLmZuICE9PSBub29wKSB7XG4gICAgb3B0aW9ucy5kYXRhID0gY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgICAvLyBXcmFwcGVyIGZ1bmN0aW9uIHRvIGdldCBhY2Nlc3MgdG8gY3VycmVudFBhcnRpYWxCbG9jayBmcm9tIHRoZSBjbG9zdXJlXG4gICAgbGV0IGZuID0gb3B0aW9ucy5mbjtcbiAgICBwYXJ0aWFsQmxvY2sgPSBvcHRpb25zLmRhdGFbJ3BhcnRpYWwtYmxvY2snXSA9IGZ1bmN0aW9uIHBhcnRpYWxCbG9ja1dyYXBwZXIoY29udGV4dCwgb3B0aW9ucyA9IHt9KSB7XG5cbiAgICAgIC8vIFJlc3RvcmUgdGhlIHBhcnRpYWwtYmxvY2sgZnJvbSB0aGUgY2xvc3VyZSBmb3IgdGhlIGV4ZWN1dGlvbiBvZiB0aGUgYmxvY2tcbiAgICAgIC8vIGkuZS4gdGhlIHBhcnQgaW5zaWRlIHRoZSBibG9jayBvZiB0aGUgcGFydGlhbCBjYWxsLlxuICAgICAgb3B0aW9ucy5kYXRhID0gY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgICAgIG9wdGlvbnMuZGF0YVsncGFydGlhbC1ibG9jayddID0gY3VycmVudFBhcnRpYWxCbG9jaztcbiAgICAgIHJldHVybiBmbihjb250ZXh0LCBvcHRpb25zKTtcbiAgICB9O1xuICAgIGlmIChmbi5wYXJ0aWFscykge1xuICAgICAgb3B0aW9ucy5wYXJ0aWFscyA9IFV0aWxzLmV4dGVuZCh7fSwgb3B0aW9ucy5wYXJ0aWFscywgZm4ucGFydGlhbHMpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChwYXJ0aWFsID09PSB1bmRlZmluZWQgJiYgcGFydGlhbEJsb2NrKSB7XG4gICAgcGFydGlhbCA9IHBhcnRpYWxCbG9jaztcbiAgfVxuXG4gIGlmIChwYXJ0aWFsID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdUaGUgcGFydGlhbCAnICsgb3B0aW9ucy5uYW1lICsgJyBjb3VsZCBub3QgYmUgZm91bmQnKTtcbiAgfSBlbHNlIGlmIChwYXJ0aWFsIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICByZXR1cm4gcGFydGlhbChjb250ZXh0LCBvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9vcCgpIHsgcmV0dXJuICcnOyB9XG5cbmZ1bmN0aW9uIGluaXREYXRhKGNvbnRleHQsIGRhdGEpIHtcbiAgaWYgKCFkYXRhIHx8ICEoJ3Jvb3QnIGluIGRhdGEpKSB7XG4gICAgZGF0YSA9IGRhdGEgPyBjcmVhdGVGcmFtZShkYXRhKSA6IHt9O1xuICAgIGRhdGEucm9vdCA9IGNvbnRleHQ7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59XG5cbmZ1bmN0aW9uIGV4ZWN1dGVEZWNvcmF0b3JzKGZuLCBwcm9nLCBjb250YWluZXIsIGRlcHRocywgZGF0YSwgYmxvY2tQYXJhbXMpIHtcbiAgaWYgKGZuLmRlY29yYXRvcikge1xuICAgIGxldCBwcm9wcyA9IHt9O1xuICAgIHByb2cgPSBmbi5kZWNvcmF0b3IocHJvZywgcHJvcHMsIGNvbnRhaW5lciwgZGVwdGhzICYmIGRlcHRoc1swXSwgZGF0YSwgYmxvY2tQYXJhbXMsIGRlcHRocyk7XG4gICAgVXRpbHMuZXh0ZW5kKHByb2csIHByb3BzKTtcbiAgfVxuICByZXR1cm4gcHJvZztcbn1cbiIsIi8vIEJ1aWxkIG91dCBvdXIgYmFzaWMgU2FmZVN0cmluZyB0eXBlXG5mdW5jdGlvbiBTYWZlU3RyaW5nKHN0cmluZykge1xuICB0aGlzLnN0cmluZyA9IHN0cmluZztcbn1cblxuU2FmZVN0cmluZy5wcm90b3R5cGUudG9TdHJpbmcgPSBTYWZlU3RyaW5nLnByb3RvdHlwZS50b0hUTUwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICcnICsgdGhpcy5zdHJpbmc7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBTYWZlU3RyaW5nO1xuIiwiY29uc3QgZXNjYXBlID0ge1xuICAnJic6ICcmYW1wOycsXG4gICc8JzogJyZsdDsnLFxuICAnPic6ICcmZ3Q7JyxcbiAgJ1wiJzogJyZxdW90OycsXG4gIFwiJ1wiOiAnJiN4Mjc7JyxcbiAgJ2AnOiAnJiN4NjA7JyxcbiAgJz0nOiAnJiN4M0Q7J1xufTtcblxuY29uc3QgYmFkQ2hhcnMgPSAvWyY8PlwiJ2A9XS9nLFxuICAgICAgcG9zc2libGUgPSAvWyY8PlwiJ2A9XS87XG5cbmZ1bmN0aW9uIGVzY2FwZUNoYXIoY2hyKSB7XG4gIHJldHVybiBlc2NhcGVbY2hyXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVuZChvYmovKiAsIC4uLnNvdXJjZSAqLykge1xuICBmb3IgKGxldCBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGZvciAobGV0IGtleSBpbiBhcmd1bWVudHNbaV0pIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYXJndW1lbnRzW2ldLCBrZXkpKSB7XG4gICAgICAgIG9ialtrZXldID0gYXJndW1lbnRzW2ldW2tleV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn1cblxuZXhwb3J0IGxldCB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8vIFNvdXJjZWQgZnJvbSBsb2Rhc2hcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXN0aWVqcy9sb2Rhc2gvYmxvYi9tYXN0ZXIvTElDRU5TRS50eHRcbi8qIGVzbGludC1kaXNhYmxlIGZ1bmMtc3R5bGUgKi9cbmxldCBpc0Z1bmN0aW9uID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJztcbn07XG4vLyBmYWxsYmFjayBmb3Igb2xkZXIgdmVyc2lvbnMgb2YgQ2hyb21lIGFuZCBTYWZhcmlcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5pZiAoaXNGdW5jdGlvbigveC8pKSB7XG4gIGlzRnVuY3Rpb24gPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG4gIH07XG59XG5leHBvcnQge2lzRnVuY3Rpb259O1xuLyogZXNsaW50LWVuYWJsZSBmdW5jLXN0eWxlICovXG5cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5leHBvcnQgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSA/IHRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nIDogZmFsc2U7XG59O1xuXG4vLyBPbGRlciBJRSB2ZXJzaW9ucyBkbyBub3QgZGlyZWN0bHkgc3VwcG9ydCBpbmRleE9mIHNvIHdlIG11c3QgaW1wbGVtZW50IG91ciBvd24sIHNhZGx5LlxuZXhwb3J0IGZ1bmN0aW9uIGluZGV4T2YoYXJyYXksIHZhbHVlKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChhcnJheVtpXSA9PT0gdmFsdWUpIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gLTE7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUV4cHJlc3Npb24oc3RyaW5nKSB7XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgIC8vIGRvbid0IGVzY2FwZSBTYWZlU3RyaW5ncywgc2luY2UgdGhleSdyZSBhbHJlYWR5IHNhZmVcbiAgICBpZiAoc3RyaW5nICYmIHN0cmluZy50b0hUTUwpIHtcbiAgICAgIHJldHVybiBzdHJpbmcudG9IVE1MKCk7XG4gICAgfSBlbHNlIGlmIChzdHJpbmcgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH0gZWxzZSBpZiAoIXN0cmluZykge1xuICAgICAgcmV0dXJuIHN0cmluZyArICcnO1xuICAgIH1cblxuICAgIC8vIEZvcmNlIGEgc3RyaW5nIGNvbnZlcnNpb24gYXMgdGhpcyB3aWxsIGJlIGRvbmUgYnkgdGhlIGFwcGVuZCByZWdhcmRsZXNzIGFuZFxuICAgIC8vIHRoZSByZWdleCB0ZXN0IHdpbGwgZG8gdGhpcyB0cmFuc3BhcmVudGx5IGJlaGluZCB0aGUgc2NlbmVzLCBjYXVzaW5nIGlzc3VlcyBpZlxuICAgIC8vIGFuIG9iamVjdCdzIHRvIHN0cmluZyBoYXMgZXNjYXBlZCBjaGFyYWN0ZXJzIGluIGl0LlxuICAgIHN0cmluZyA9ICcnICsgc3RyaW5nO1xuICB9XG5cbiAgaWYgKCFwb3NzaWJsZS50ZXN0KHN0cmluZykpIHsgcmV0dXJuIHN0cmluZzsgfVxuICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoYmFkQ2hhcnMsIGVzY2FwZUNoYXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFbXB0eSh2YWx1ZSkge1xuICBpZiAoIXZhbHVlICYmIHZhbHVlICE9PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGcmFtZShvYmplY3QpIHtcbiAgbGV0IGZyYW1lID0gZXh0ZW5kKHt9LCBvYmplY3QpO1xuICBmcmFtZS5fcGFyZW50ID0gb2JqZWN0O1xuICByZXR1cm4gZnJhbWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBibG9ja1BhcmFtcyhwYXJhbXMsIGlkcykge1xuICBwYXJhbXMucGF0aCA9IGlkcztcbiAgcmV0dXJuIHBhcmFtcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZENvbnRleHRQYXRoKGNvbnRleHRQYXRoLCBpZCkge1xuICByZXR1cm4gKGNvbnRleHRQYXRoID8gY29udGV4dFBhdGggKyAnLicgOiAnJykgKyBpZDtcbn1cbiIsIi8vIFVTQUdFOlxuLy8gdmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYW5kbGViYXJzJyk7XG4vKiBlc2xpbnQtZGlzYWJsZSBuby12YXIgKi9cblxuLy8gdmFyIGxvY2FsID0gaGFuZGxlYmFycy5jcmVhdGUoKTtcblxudmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKCcuLi9kaXN0L2Nqcy9oYW5kbGViYXJzJylbJ2RlZmF1bHQnXTtcblxudmFyIHByaW50ZXIgPSByZXF1aXJlKCcuLi9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3ByaW50ZXInKTtcbmhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yID0gcHJpbnRlci5QcmludFZpc2l0b3I7XG5oYW5kbGViYXJzLnByaW50ID0gcHJpbnRlci5wcmludDtcblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGViYXJzO1xuXG4vLyBQdWJsaXNoIGEgTm9kZS5qcyByZXF1aXJlKCkgaGFuZGxlciBmb3IgLmhhbmRsZWJhcnMgYW5kIC5oYnMgZmlsZXNcbmZ1bmN0aW9uIGV4dGVuc2lvbihtb2R1bGUsIGZpbGVuYW1lKSB7XG4gIHZhciBmcyA9IHJlcXVpcmUoJ2ZzJyk7XG4gIHZhciB0ZW1wbGF0ZVN0cmluZyA9IGZzLnJlYWRGaWxlU3luYyhmaWxlbmFtZSwgJ3V0ZjgnKTtcbiAgbW9kdWxlLmV4cG9ydHMgPSBoYW5kbGViYXJzLmNvbXBpbGUodGVtcGxhdGVTdHJpbmcpO1xufVxuLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbmlmICh0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgJiYgcmVxdWlyZS5leHRlbnNpb25zKSB7XG4gIHJlcXVpcmUuZXh0ZW5zaW9uc1snLmhhbmRsZWJhcnMnXSA9IGV4dGVuc2lvbjtcbiAgcmVxdWlyZS5leHRlbnNpb25zWycuaGJzJ10gPSBleHRlbnNpb247XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0UudHh0IG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5leHBvcnRzLlNvdXJjZU1hcEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vc291cmNlLW1hcC9zb3VyY2UtbWFwLWdlbmVyYXRvcicpLlNvdXJjZU1hcEdlbmVyYXRvcjtcbmV4cG9ydHMuU291cmNlTWFwQ29uc3VtZXIgPSByZXF1aXJlKCcuL3NvdXJjZS1tYXAvc291cmNlLW1hcC1jb25zdW1lcicpLlNvdXJjZU1hcENvbnN1bWVyO1xuZXhwb3J0cy5Tb3VyY2VOb2RlID0gcmVxdWlyZSgnLi9zb3VyY2UtbWFwL3NvdXJjZS1ub2RlJykuU291cmNlTm9kZTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuICAvKipcbiAgICogQSBkYXRhIHN0cnVjdHVyZSB3aGljaCBpcyBhIGNvbWJpbmF0aW9uIG9mIGFuIGFycmF5IGFuZCBhIHNldC4gQWRkaW5nIGEgbmV3XG4gICAqIG1lbWJlciBpcyBPKDEpLCB0ZXN0aW5nIGZvciBtZW1iZXJzaGlwIGlzIE8oMSksIGFuZCBmaW5kaW5nIHRoZSBpbmRleCBvZiBhblxuICAgKiBlbGVtZW50IGlzIE8oMSkuIFJlbW92aW5nIGVsZW1lbnRzIGZyb20gdGhlIHNldCBpcyBub3Qgc3VwcG9ydGVkLiBPbmx5XG4gICAqIHN0cmluZ3MgYXJlIHN1cHBvcnRlZCBmb3IgbWVtYmVyc2hpcC5cbiAgICovXG4gIGZ1bmN0aW9uIEFycmF5U2V0KCkge1xuICAgIHRoaXMuX2FycmF5ID0gW107XG4gICAgdGhpcy5fc2V0ID0ge307XG4gIH1cblxuICAvKipcbiAgICogU3RhdGljIG1ldGhvZCBmb3IgY3JlYXRpbmcgQXJyYXlTZXQgaW5zdGFuY2VzIGZyb20gYW4gZXhpc3RpbmcgYXJyYXkuXG4gICAqL1xuICBBcnJheVNldC5mcm9tQXJyYXkgPSBmdW5jdGlvbiBBcnJheVNldF9mcm9tQXJyYXkoYUFycmF5LCBhQWxsb3dEdXBsaWNhdGVzKSB7XG4gICAgdmFyIHNldCA9IG5ldyBBcnJheVNldCgpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhQXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHNldC5hZGQoYUFycmF5W2ldLCBhQWxsb3dEdXBsaWNhdGVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHNldDtcbiAgfTtcblxuICAvKipcbiAgICogUmV0dXJuIGhvdyBtYW55IHVuaXF1ZSBpdGVtcyBhcmUgaW4gdGhpcyBBcnJheVNldC4gSWYgZHVwbGljYXRlcyBoYXZlIGJlZW5cbiAgICogYWRkZWQsIHRoYW4gdGhvc2UgZG8gbm90IGNvdW50IHRvd2FyZHMgdGhlIHNpemUuXG4gICAqXG4gICAqIEByZXR1cm5zIE51bWJlclxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLnNpemUgPSBmdW5jdGlvbiBBcnJheVNldF9zaXplKCkge1xuICAgIHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzLl9zZXQpLmxlbmd0aDtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIHRoZSBnaXZlbiBzdHJpbmcgdG8gdGhpcyBzZXQuXG4gICAqXG4gICAqIEBwYXJhbSBTdHJpbmcgYVN0clxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIEFycmF5U2V0X2FkZChhU3RyLCBhQWxsb3dEdXBsaWNhdGVzKSB7XG4gICAgdmFyIGlzRHVwbGljYXRlID0gdGhpcy5oYXMoYVN0cik7XG4gICAgdmFyIGlkeCA9IHRoaXMuX2FycmF5Lmxlbmd0aDtcbiAgICBpZiAoIWlzRHVwbGljYXRlIHx8IGFBbGxvd0R1cGxpY2F0ZXMpIHtcbiAgICAgIHRoaXMuX2FycmF5LnB1c2goYVN0cik7XG4gICAgfVxuICAgIGlmICghaXNEdXBsaWNhdGUpIHtcbiAgICAgIHRoaXMuX3NldFt1dGlsLnRvU2V0U3RyaW5nKGFTdHIpXSA9IGlkeDtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIElzIHRoZSBnaXZlbiBzdHJpbmcgYSBtZW1iZXIgb2YgdGhpcyBzZXQ/XG4gICAqXG4gICAqIEBwYXJhbSBTdHJpbmcgYVN0clxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uIEFycmF5U2V0X2hhcyhhU3RyKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLl9zZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLnRvU2V0U3RyaW5nKGFTdHIpKTtcbiAgfTtcblxuICAvKipcbiAgICogV2hhdCBpcyB0aGUgaW5kZXggb2YgdGhlIGdpdmVuIHN0cmluZyBpbiB0aGUgYXJyYXk/XG4gICAqXG4gICAqIEBwYXJhbSBTdHJpbmcgYVN0clxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBBcnJheVNldF9pbmRleE9mKGFTdHIpIHtcbiAgICBpZiAodGhpcy5oYXMoYVN0cikpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zZXRbdXRpbC50b1NldFN0cmluZyhhU3RyKV07XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcignXCInICsgYVN0ciArICdcIiBpcyBub3QgaW4gdGhlIHNldC4nKTtcbiAgfTtcblxuICAvKipcbiAgICogV2hhdCBpcyB0aGUgZWxlbWVudCBhdCB0aGUgZ2l2ZW4gaW5kZXg/XG4gICAqXG4gICAqIEBwYXJhbSBOdW1iZXIgYUlkeFxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmF0ID0gZnVuY3Rpb24gQXJyYXlTZXRfYXQoYUlkeCkge1xuICAgIGlmIChhSWR4ID49IDAgJiYgYUlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FycmF5W2FJZHhdO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGVsZW1lbnQgaW5kZXhlZCBieSAnICsgYUlkeCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGFycmF5IHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgc2V0ICh3aGljaCBoYXMgdGhlIHByb3BlciBpbmRpY2VzXG4gICAqIGluZGljYXRlZCBieSBpbmRleE9mKS4gTm90ZSB0aGF0IHRoaXMgaXMgYSBjb3B5IG9mIHRoZSBpbnRlcm5hbCBhcnJheSB1c2VkXG4gICAqIGZvciBzdG9yaW5nIHRoZSBtZW1iZXJzIHNvIHRoYXQgbm8gb25lIGNhbiBtZXNzIHdpdGggaW50ZXJuYWwgc3RhdGUuXG4gICAqL1xuICBBcnJheVNldC5wcm90b3R5cGUudG9BcnJheSA9IGZ1bmN0aW9uIEFycmF5U2V0X3RvQXJyYXkoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2FycmF5LnNsaWNlKCk7XG4gIH07XG5cbiAgZXhwb3J0cy5BcnJheVNldCA9IEFycmF5U2V0O1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKlxuICogQmFzZWQgb24gdGhlIEJhc2UgNjQgVkxRIGltcGxlbWVudGF0aW9uIGluIENsb3N1cmUgQ29tcGlsZXI6XG4gKiBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nsb3N1cmUtY29tcGlsZXIvc291cmNlL2Jyb3dzZS90cnVuay9zcmMvY29tL2dvb2dsZS9kZWJ1Z2dpbmcvc291cmNlbWFwL0Jhc2U2NFZMUS5qYXZhXG4gKlxuICogQ29weXJpZ2h0IDIwMTEgVGhlIENsb3N1cmUgQ29tcGlsZXIgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqICAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKiAgKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKiAgKiBOZWl0aGVyIHRoZSBuYW1lIG9mIEdvb2dsZSBJbmMuIG5vciB0aGUgbmFtZXMgb2YgaXRzXG4gKiAgICBjb250cmlidXRvcnMgbWF5IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzIGRlcml2ZWRcbiAqICAgIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTXG4gKiBcIkFTIElTXCIgQU5EIEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UXG4gKiBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1JcbiAqIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUXG4gKiBPV05FUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCxcbiAqIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiAqIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLFxuICogREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZXG4gKiBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4gKiAoSU5DTFVESU5HIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0VcbiAqIE9GIFRISVMgU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIGJhc2U2NCA9IHJlcXVpcmUoJy4vYmFzZTY0Jyk7XG5cbiAgLy8gQSBzaW5nbGUgYmFzZSA2NCBkaWdpdCBjYW4gY29udGFpbiA2IGJpdHMgb2YgZGF0YS4gRm9yIHRoZSBiYXNlIDY0IHZhcmlhYmxlXG4gIC8vIGxlbmd0aCBxdWFudGl0aWVzIHdlIHVzZSBpbiB0aGUgc291cmNlIG1hcCBzcGVjLCB0aGUgZmlyc3QgYml0IGlzIHRoZSBzaWduLFxuICAvLyB0aGUgbmV4dCBmb3VyIGJpdHMgYXJlIHRoZSBhY3R1YWwgdmFsdWUsIGFuZCB0aGUgNnRoIGJpdCBpcyB0aGVcbiAgLy8gY29udGludWF0aW9uIGJpdC4gVGhlIGNvbnRpbnVhdGlvbiBiaXQgdGVsbHMgdXMgd2hldGhlciB0aGVyZSBhcmUgbW9yZVxuICAvLyBkaWdpdHMgaW4gdGhpcyB2YWx1ZSBmb2xsb3dpbmcgdGhpcyBkaWdpdC5cbiAgLy9cbiAgLy8gICBDb250aW51YXRpb25cbiAgLy8gICB8ICAgIFNpZ25cbiAgLy8gICB8ICAgIHxcbiAgLy8gICBWICAgIFZcbiAgLy8gICAxMDEwMTFcblxuICB2YXIgVkxRX0JBU0VfU0hJRlQgPSA1O1xuXG4gIC8vIGJpbmFyeTogMTAwMDAwXG4gIHZhciBWTFFfQkFTRSA9IDEgPDwgVkxRX0JBU0VfU0hJRlQ7XG5cbiAgLy8gYmluYXJ5OiAwMTExMTFcbiAgdmFyIFZMUV9CQVNFX01BU0sgPSBWTFFfQkFTRSAtIDE7XG5cbiAgLy8gYmluYXJ5OiAxMDAwMDBcbiAgdmFyIFZMUV9DT05USU5VQVRJT05fQklUID0gVkxRX0JBU0U7XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGZyb20gYSB0d28tY29tcGxlbWVudCB2YWx1ZSB0byBhIHZhbHVlIHdoZXJlIHRoZSBzaWduIGJpdCBpc1xuICAgKiBwbGFjZWQgaW4gdGhlIGxlYXN0IHNpZ25pZmljYW50IGJpdC4gIEZvciBleGFtcGxlLCBhcyBkZWNpbWFsczpcbiAgICogICAxIGJlY29tZXMgMiAoMTAgYmluYXJ5KSwgLTEgYmVjb21lcyAzICgxMSBiaW5hcnkpXG4gICAqICAgMiBiZWNvbWVzIDQgKDEwMCBiaW5hcnkpLCAtMiBiZWNvbWVzIDUgKDEwMSBiaW5hcnkpXG4gICAqL1xuICBmdW5jdGlvbiB0b1ZMUVNpZ25lZChhVmFsdWUpIHtcbiAgICByZXR1cm4gYVZhbHVlIDwgMFxuICAgICAgPyAoKC1hVmFsdWUpIDw8IDEpICsgMVxuICAgICAgOiAoYVZhbHVlIDw8IDEpICsgMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0byBhIHR3by1jb21wbGVtZW50IHZhbHVlIGZyb20gYSB2YWx1ZSB3aGVyZSB0aGUgc2lnbiBiaXQgaXNcbiAgICogcGxhY2VkIGluIHRoZSBsZWFzdCBzaWduaWZpY2FudCBiaXQuICBGb3IgZXhhbXBsZSwgYXMgZGVjaW1hbHM6XG4gICAqICAgMiAoMTAgYmluYXJ5KSBiZWNvbWVzIDEsIDMgKDExIGJpbmFyeSkgYmVjb21lcyAtMVxuICAgKiAgIDQgKDEwMCBiaW5hcnkpIGJlY29tZXMgMiwgNSAoMTAxIGJpbmFyeSkgYmVjb21lcyAtMlxuICAgKi9cbiAgZnVuY3Rpb24gZnJvbVZMUVNpZ25lZChhVmFsdWUpIHtcbiAgICB2YXIgaXNOZWdhdGl2ZSA9IChhVmFsdWUgJiAxKSA9PT0gMTtcbiAgICB2YXIgc2hpZnRlZCA9IGFWYWx1ZSA+PiAxO1xuICAgIHJldHVybiBpc05lZ2F0aXZlXG4gICAgICA/IC1zaGlmdGVkXG4gICAgICA6IHNoaWZ0ZWQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgYmFzZSA2NCBWTFEgZW5jb2RlZCB2YWx1ZS5cbiAgICovXG4gIGV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24gYmFzZTY0VkxRX2VuY29kZShhVmFsdWUpIHtcbiAgICB2YXIgZW5jb2RlZCA9IFwiXCI7XG4gICAgdmFyIGRpZ2l0O1xuXG4gICAgdmFyIHZscSA9IHRvVkxRU2lnbmVkKGFWYWx1ZSk7XG5cbiAgICBkbyB7XG4gICAgICBkaWdpdCA9IHZscSAmIFZMUV9CQVNFX01BU0s7XG4gICAgICB2bHEgPj4+PSBWTFFfQkFTRV9TSElGVDtcbiAgICAgIGlmICh2bHEgPiAwKSB7XG4gICAgICAgIC8vIFRoZXJlIGFyZSBzdGlsbCBtb3JlIGRpZ2l0cyBpbiB0aGlzIHZhbHVlLCBzbyB3ZSBtdXN0IG1ha2Ugc3VyZSB0aGVcbiAgICAgICAgLy8gY29udGludWF0aW9uIGJpdCBpcyBtYXJrZWQuXG4gICAgICAgIGRpZ2l0IHw9IFZMUV9DT05USU5VQVRJT05fQklUO1xuICAgICAgfVxuICAgICAgZW5jb2RlZCArPSBiYXNlNjQuZW5jb2RlKGRpZ2l0KTtcbiAgICB9IHdoaWxlICh2bHEgPiAwKTtcblxuICAgIHJldHVybiBlbmNvZGVkO1xuICB9O1xuXG4gIC8qKlxuICAgKiBEZWNvZGVzIHRoZSBuZXh0IGJhc2UgNjQgVkxRIHZhbHVlIGZyb20gdGhlIGdpdmVuIHN0cmluZyBhbmQgcmV0dXJucyB0aGVcbiAgICogdmFsdWUgYW5kIHRoZSByZXN0IG9mIHRoZSBzdHJpbmcgdmlhIHRoZSBvdXQgcGFyYW1ldGVyLlxuICAgKi9cbiAgZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiBiYXNlNjRWTFFfZGVjb2RlKGFTdHIsIGFJbmRleCwgYU91dFBhcmFtKSB7XG4gICAgdmFyIHN0ckxlbiA9IGFTdHIubGVuZ3RoO1xuICAgIHZhciByZXN1bHQgPSAwO1xuICAgIHZhciBzaGlmdCA9IDA7XG4gICAgdmFyIGNvbnRpbnVhdGlvbiwgZGlnaXQ7XG5cbiAgICBkbyB7XG4gICAgICBpZiAoYUluZGV4ID49IHN0ckxlbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBtb3JlIGRpZ2l0cyBpbiBiYXNlIDY0IFZMUSB2YWx1ZS5cIik7XG4gICAgICB9XG5cbiAgICAgIGRpZ2l0ID0gYmFzZTY0LmRlY29kZShhU3RyLmNoYXJDb2RlQXQoYUluZGV4KyspKTtcbiAgICAgIGlmIChkaWdpdCA9PT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBiYXNlNjQgZGlnaXQ6IFwiICsgYVN0ci5jaGFyQXQoYUluZGV4IC0gMSkpO1xuICAgICAgfVxuXG4gICAgICBjb250aW51YXRpb24gPSAhIShkaWdpdCAmIFZMUV9DT05USU5VQVRJT05fQklUKTtcbiAgICAgIGRpZ2l0ICY9IFZMUV9CQVNFX01BU0s7XG4gICAgICByZXN1bHQgPSByZXN1bHQgKyAoZGlnaXQgPDwgc2hpZnQpO1xuICAgICAgc2hpZnQgKz0gVkxRX0JBU0VfU0hJRlQ7XG4gICAgfSB3aGlsZSAoY29udGludWF0aW9uKTtcblxuICAgIGFPdXRQYXJhbS52YWx1ZSA9IGZyb21WTFFTaWduZWQocmVzdWx0KTtcbiAgICBhT3V0UGFyYW0ucmVzdCA9IGFJbmRleDtcbiAgfTtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciBpbnRUb0NoYXJNYXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLycuc3BsaXQoJycpO1xuXG4gIC8qKlxuICAgKiBFbmNvZGUgYW4gaW50ZWdlciBpbiB0aGUgcmFuZ2Ugb2YgMCB0byA2MyB0byBhIHNpbmdsZSBiYXNlIDY0IGRpZ2l0LlxuICAgKi9cbiAgZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbiAobnVtYmVyKSB7XG4gICAgaWYgKDAgPD0gbnVtYmVyICYmIG51bWJlciA8IGludFRvQ2hhck1hcC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBpbnRUb0NoYXJNYXBbbnVtYmVyXTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk11c3QgYmUgYmV0d2VlbiAwIGFuZCA2MzogXCIgKyBhTnVtYmVyKTtcbiAgfTtcblxuICAvKipcbiAgICogRGVjb2RlIGEgc2luZ2xlIGJhc2UgNjQgY2hhcmFjdGVyIGNvZGUgZGlnaXQgdG8gYW4gaW50ZWdlci4gUmV0dXJucyAtMSBvblxuICAgKiBmYWlsdXJlLlxuICAgKi9cbiAgZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiAoY2hhckNvZGUpIHtcbiAgICB2YXIgYmlnQSA9IDY1OyAgICAgLy8gJ0EnXG4gICAgdmFyIGJpZ1ogPSA5MDsgICAgIC8vICdaJ1xuXG4gICAgdmFyIGxpdHRsZUEgPSA5NzsgIC8vICdhJ1xuICAgIHZhciBsaXR0bGVaID0gMTIyOyAvLyAneidcblxuICAgIHZhciB6ZXJvID0gNDg7ICAgICAvLyAnMCdcbiAgICB2YXIgbmluZSA9IDU3OyAgICAgLy8gJzknXG5cbiAgICB2YXIgcGx1cyA9IDQzOyAgICAgLy8gJysnXG4gICAgdmFyIHNsYXNoID0gNDc7ICAgIC8vICcvJ1xuXG4gICAgdmFyIGxpdHRsZU9mZnNldCA9IDI2O1xuICAgIHZhciBudW1iZXJPZmZzZXQgPSA1MjtcblxuICAgIC8vIDAgLSAyNTogQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpcbiAgICBpZiAoYmlnQSA8PSBjaGFyQ29kZSAmJiBjaGFyQ29kZSA8PSBiaWdaKSB7XG4gICAgICByZXR1cm4gKGNoYXJDb2RlIC0gYmlnQSk7XG4gICAgfVxuXG4gICAgLy8gMjYgLSA1MTogYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpcbiAgICBpZiAobGl0dGxlQSA8PSBjaGFyQ29kZSAmJiBjaGFyQ29kZSA8PSBsaXR0bGVaKSB7XG4gICAgICByZXR1cm4gKGNoYXJDb2RlIC0gbGl0dGxlQSArIGxpdHRsZU9mZnNldCk7XG4gICAgfVxuXG4gICAgLy8gNTIgLSA2MTogMDEyMzQ1Njc4OVxuICAgIGlmICh6ZXJvIDw9IGNoYXJDb2RlICYmIGNoYXJDb2RlIDw9IG5pbmUpIHtcbiAgICAgIHJldHVybiAoY2hhckNvZGUgLSB6ZXJvICsgbnVtYmVyT2Zmc2V0KTtcbiAgICB9XG5cbiAgICAvLyA2MjogK1xuICAgIGlmIChjaGFyQ29kZSA9PSBwbHVzKSB7XG4gICAgICByZXR1cm4gNjI7XG4gICAgfVxuXG4gICAgLy8gNjM6IC9cbiAgICBpZiAoY2hhckNvZGUgPT0gc2xhc2gpIHtcbiAgICAgIHJldHVybiA2MztcbiAgICB9XG5cbiAgICAvLyBJbnZhbGlkIGJhc2U2NCBkaWdpdC5cbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbn0pO1xuIiwiLyogLSotIE1vZGU6IGpzOyBqcy1pbmRlbnQtbGV2ZWw6IDI7IC0qLSAqL1xuLypcbiAqIENvcHlyaWdodCAyMDExIE1vemlsbGEgRm91bmRhdGlvbiBhbmQgY29udHJpYnV0b3JzXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTmV3IEJTRCBsaWNlbnNlLiBTZWUgTElDRU5TRSBvcjpcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMy1DbGF1c2VcbiAqL1xuaWYgKHR5cGVvZiBkZWZpbmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgZGVmaW5lID0gcmVxdWlyZSgnYW1kZWZpbmUnKShtb2R1bGUsIHJlcXVpcmUpO1xufVxuZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcblxuICBleHBvcnRzLkdSRUFURVNUX0xPV0VSX0JPVU5EID0gMTtcbiAgZXhwb3J0cy5MRUFTVF9VUFBFUl9CT1VORCA9IDI7XG5cbiAgLyoqXG4gICAqIFJlY3Vyc2l2ZSBpbXBsZW1lbnRhdGlvbiBvZiBiaW5hcnkgc2VhcmNoLlxuICAgKlxuICAgKiBAcGFyYW0gYUxvdyBJbmRpY2VzIGhlcmUgYW5kIGxvd2VyIGRvIG5vdCBjb250YWluIHRoZSBuZWVkbGUuXG4gICAqIEBwYXJhbSBhSGlnaCBJbmRpY2VzIGhlcmUgYW5kIGhpZ2hlciBkbyBub3QgY29udGFpbiB0aGUgbmVlZGxlLlxuICAgKiBAcGFyYW0gYU5lZWRsZSBUaGUgZWxlbWVudCBiZWluZyBzZWFyY2hlZCBmb3IuXG4gICAqIEBwYXJhbSBhSGF5c3RhY2sgVGhlIG5vbi1lbXB0eSBhcnJheSBiZWluZyBzZWFyY2hlZC5cbiAgICogQHBhcmFtIGFDb21wYXJlIEZ1bmN0aW9uIHdoaWNoIHRha2VzIHR3byBlbGVtZW50cyBhbmQgcmV0dXJucyAtMSwgMCwgb3IgMS5cbiAgICogQHBhcmFtIGFCaWFzIEVpdGhlciAnYmluYXJ5U2VhcmNoLkdSRUFURVNUX0xPV0VSX0JPVU5EJyBvclxuICAgKiAgICAgJ2JpbmFyeVNlYXJjaC5MRUFTVF9VUFBFUl9CT1VORCcuIFNwZWNpZmllcyB3aGV0aGVyIHRvIHJldHVybiB0aGVcbiAgICogICAgIGNsb3Nlc3QgZWxlbWVudCB0aGF0IGlzIHNtYWxsZXIgdGhhbiBvciBncmVhdGVyIHRoYW4gdGhlIG9uZSB3ZSBhcmVcbiAgICogICAgIHNlYXJjaGluZyBmb3IsIHJlc3BlY3RpdmVseSwgaWYgdGhlIGV4YWN0IGVsZW1lbnQgY2Fubm90IGJlIGZvdW5kLlxuICAgKi9cbiAgZnVuY3Rpb24gcmVjdXJzaXZlU2VhcmNoKGFMb3csIGFIaWdoLCBhTmVlZGxlLCBhSGF5c3RhY2ssIGFDb21wYXJlLCBhQmlhcykge1xuICAgIC8vIFRoaXMgZnVuY3Rpb24gdGVybWluYXRlcyB3aGVuIG9uZSBvZiB0aGUgZm9sbG93aW5nIGlzIHRydWU6XG4gICAgLy9cbiAgICAvLyAgIDEuIFdlIGZpbmQgdGhlIGV4YWN0IGVsZW1lbnQgd2UgYXJlIGxvb2tpbmcgZm9yLlxuICAgIC8vXG4gICAgLy8gICAyLiBXZSBkaWQgbm90IGZpbmQgdGhlIGV4YWN0IGVsZW1lbnQsIGJ1dCB3ZSBjYW4gcmV0dXJuIHRoZSBpbmRleCBvZlxuICAgIC8vICAgICAgdGhlIG5leHQtY2xvc2VzdCBlbGVtZW50LlxuICAgIC8vXG4gICAgLy8gICAzLiBXZSBkaWQgbm90IGZpbmQgdGhlIGV4YWN0IGVsZW1lbnQsIGFuZCB0aGVyZSBpcyBubyBuZXh0LWNsb3Nlc3RcbiAgICAvLyAgICAgIGVsZW1lbnQgdGhhbiB0aGUgb25lIHdlIGFyZSBzZWFyY2hpbmcgZm9yLCBzbyB3ZSByZXR1cm4gLTEuXG4gICAgdmFyIG1pZCA9IE1hdGguZmxvb3IoKGFIaWdoIC0gYUxvdykgLyAyKSArIGFMb3c7XG4gICAgdmFyIGNtcCA9IGFDb21wYXJlKGFOZWVkbGUsIGFIYXlzdGFja1ttaWRdLCB0cnVlKTtcbiAgICBpZiAoY21wID09PSAwKSB7XG4gICAgICAvLyBGb3VuZCB0aGUgZWxlbWVudCB3ZSBhcmUgbG9va2luZyBmb3IuXG4gICAgICByZXR1cm4gbWlkO1xuICAgIH1cbiAgICBlbHNlIGlmIChjbXAgPiAwKSB7XG4gICAgICAvLyBPdXIgbmVlZGxlIGlzIGdyZWF0ZXIgdGhhbiBhSGF5c3RhY2tbbWlkXS5cbiAgICAgIGlmIChhSGlnaCAtIG1pZCA+IDEpIHtcbiAgICAgICAgLy8gVGhlIGVsZW1lbnQgaXMgaW4gdGhlIHVwcGVyIGhhbGYuXG4gICAgICAgIHJldHVybiByZWN1cnNpdmVTZWFyY2gobWlkLCBhSGlnaCwgYU5lZWRsZSwgYUhheXN0YWNrLCBhQ29tcGFyZSwgYUJpYXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgZXhhY3QgbmVlZGxlIGVsZW1lbnQgd2FzIG5vdCBmb3VuZCBpbiB0aGlzIGhheXN0YWNrLiBEZXRlcm1pbmUgaWZcbiAgICAgIC8vIHdlIGFyZSBpbiB0ZXJtaW5hdGlvbiBjYXNlICgzKSBvciAoMikgYW5kIHJldHVybiB0aGUgYXBwcm9wcmlhdGUgdGhpbmcuXG4gICAgICBpZiAoYUJpYXMgPT0gZXhwb3J0cy5MRUFTVF9VUFBFUl9CT1VORCkge1xuICAgICAgICByZXR1cm4gYUhpZ2ggPCBhSGF5c3RhY2subGVuZ3RoID8gYUhpZ2ggOiAtMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBtaWQ7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gT3VyIG5lZWRsZSBpcyBsZXNzIHRoYW4gYUhheXN0YWNrW21pZF0uXG4gICAgICBpZiAobWlkIC0gYUxvdyA+IDEpIHtcbiAgICAgICAgLy8gVGhlIGVsZW1lbnQgaXMgaW4gdGhlIGxvd2VyIGhhbGYuXG4gICAgICAgIHJldHVybiByZWN1cnNpdmVTZWFyY2goYUxvdywgbWlkLCBhTmVlZGxlLCBhSGF5c3RhY2ssIGFDb21wYXJlLCBhQmlhcyk7XG4gICAgICB9XG5cbiAgICAgIC8vIHdlIGFyZSBpbiB0ZXJtaW5hdGlvbiBjYXNlICgzKSBvciAoMikgYW5kIHJldHVybiB0aGUgYXBwcm9wcmlhdGUgdGhpbmcuXG4gICAgICBpZiAoYUJpYXMgPT0gZXhwb3J0cy5MRUFTVF9VUFBFUl9CT1VORCkge1xuICAgICAgICByZXR1cm4gbWlkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGFMb3cgPCAwID8gLTEgOiBhTG93O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGlzIGFuIGltcGxlbWVudGF0aW9uIG9mIGJpbmFyeSBzZWFyY2ggd2hpY2ggd2lsbCBhbHdheXMgdHJ5IGFuZCByZXR1cm5cbiAgICogdGhlIGluZGV4IG9mIHRoZSBjbG9zZXN0IGVsZW1lbnQgaWYgdGhlcmUgaXMgbm8gZXhhY3QgaGl0LiBUaGlzIGlzIGJlY2F1c2VcbiAgICogbWFwcGluZ3MgYmV0d2VlbiBvcmlnaW5hbCBhbmQgZ2VuZXJhdGVkIGxpbmUvY29sIHBhaXJzIGFyZSBzaW5nbGUgcG9pbnRzLFxuICAgKiBhbmQgdGhlcmUgaXMgYW4gaW1wbGljaXQgcmVnaW9uIGJldHdlZW4gZWFjaCBvZiB0aGVtLCBzbyBhIG1pc3MganVzdCBtZWFuc1xuICAgKiB0aGF0IHlvdSBhcmVuJ3Qgb24gdGhlIHZlcnkgc3RhcnQgb2YgYSByZWdpb24uXG4gICAqXG4gICAqIEBwYXJhbSBhTmVlZGxlIFRoZSBlbGVtZW50IHlvdSBhcmUgbG9va2luZyBmb3IuXG4gICAqIEBwYXJhbSBhSGF5c3RhY2sgVGhlIGFycmF5IHRoYXQgaXMgYmVpbmcgc2VhcmNoZWQuXG4gICAqIEBwYXJhbSBhQ29tcGFyZSBBIGZ1bmN0aW9uIHdoaWNoIHRha2VzIHRoZSBuZWVkbGUgYW5kIGFuIGVsZW1lbnQgaW4gdGhlXG4gICAqICAgICBhcnJheSBhbmQgcmV0dXJucyAtMSwgMCwgb3IgMSBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgbmVlZGxlIGlzIGxlc3NcbiAgICogICAgIHRoYW4sIGVxdWFsIHRvLCBvciBncmVhdGVyIHRoYW4gdGhlIGVsZW1lbnQsIHJlc3BlY3RpdmVseS5cbiAgICogQHBhcmFtIGFCaWFzIEVpdGhlciAnYmluYXJ5U2VhcmNoLkdSRUFURVNUX0xPV0VSX0JPVU5EJyBvclxuICAgKiAgICAgJ2JpbmFyeVNlYXJjaC5MRUFTVF9VUFBFUl9CT1VORCcuIFNwZWNpZmllcyB3aGV0aGVyIHRvIHJldHVybiB0aGVcbiAgICogICAgIGNsb3Nlc3QgZWxlbWVudCB0aGF0IGlzIHNtYWxsZXIgdGhhbiBvciBncmVhdGVyIHRoYW4gdGhlIG9uZSB3ZSBhcmVcbiAgICogICAgIHNlYXJjaGluZyBmb3IsIHJlc3BlY3RpdmVseSwgaWYgdGhlIGV4YWN0IGVsZW1lbnQgY2Fubm90IGJlIGZvdW5kLlxuICAgKiAgICAgRGVmYXVsdHMgdG8gJ2JpbmFyeVNlYXJjaC5HUkVBVEVTVF9MT1dFUl9CT1VORCcuXG4gICAqL1xuICBleHBvcnRzLnNlYXJjaCA9IGZ1bmN0aW9uIHNlYXJjaChhTmVlZGxlLCBhSGF5c3RhY2ssIGFDb21wYXJlLCBhQmlhcykge1xuICAgIGlmIChhSGF5c3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gcmVjdXJzaXZlU2VhcmNoKC0xLCBhSGF5c3RhY2subGVuZ3RoLCBhTmVlZGxlLCBhSGF5c3RhY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFDb21wYXJlLCBhQmlhcyB8fCBleHBvcnRzLkdSRUFURVNUX0xPV0VSX0JPVU5EKTtcbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgLy8gV2UgaGF2ZSBmb3VuZCBlaXRoZXIgdGhlIGV4YWN0IGVsZW1lbnQsIG9yIHRoZSBuZXh0LWNsb3Nlc3QgZWxlbWVudCB0aGFuXG4gICAgLy8gdGhlIG9uZSB3ZSBhcmUgc2VhcmNoaW5nIGZvci4gSG93ZXZlciwgdGhlcmUgbWF5IGJlIG1vcmUgdGhhbiBvbmUgc3VjaFxuICAgIC8vIGVsZW1lbnQuIE1ha2Ugc3VyZSB3ZSBhbHdheXMgcmV0dXJuIHRoZSBzbWFsbGVzdCBvZiB0aGVzZS5cbiAgICB3aGlsZSAoaW5kZXggLSAxID49IDApIHtcbiAgICAgIGlmIChhQ29tcGFyZShhSGF5c3RhY2tbaW5kZXhdLCBhSGF5c3RhY2tbaW5kZXggLSAxXSwgdHJ1ZSkgIT09IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAtLWluZGV4O1xuICAgIH1cblxuICAgIHJldHVybiBpbmRleDtcbiAgfTtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTQgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbiAgLyoqXG4gICAqIERldGVybWluZSB3aGV0aGVyIG1hcHBpbmdCIGlzIGFmdGVyIG1hcHBpbmdBIHdpdGggcmVzcGVjdCB0byBnZW5lcmF0ZWRcbiAgICogcG9zaXRpb24uXG4gICAqL1xuICBmdW5jdGlvbiBnZW5lcmF0ZWRQb3NpdGlvbkFmdGVyKG1hcHBpbmdBLCBtYXBwaW5nQikge1xuICAgIC8vIE9wdGltaXplZCBmb3IgbW9zdCBjb21tb24gY2FzZVxuICAgIHZhciBsaW5lQSA9IG1hcHBpbmdBLmdlbmVyYXRlZExpbmU7XG4gICAgdmFyIGxpbmVCID0gbWFwcGluZ0IuZ2VuZXJhdGVkTGluZTtcbiAgICB2YXIgY29sdW1uQSA9IG1hcHBpbmdBLmdlbmVyYXRlZENvbHVtbjtcbiAgICB2YXIgY29sdW1uQiA9IG1hcHBpbmdCLmdlbmVyYXRlZENvbHVtbjtcbiAgICByZXR1cm4gbGluZUIgPiBsaW5lQSB8fCBsaW5lQiA9PSBsaW5lQSAmJiBjb2x1bW5CID49IGNvbHVtbkEgfHxcbiAgICAgICAgICAgdXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNJbmZsYXRlZChtYXBwaW5nQSwgbWFwcGluZ0IpIDw9IDA7XG4gIH1cblxuICAvKipcbiAgICogQSBkYXRhIHN0cnVjdHVyZSB0byBwcm92aWRlIGEgc29ydGVkIHZpZXcgb2YgYWNjdW11bGF0ZWQgbWFwcGluZ3MgaW4gYVxuICAgKiBwZXJmb3JtYW5jZSBjb25zY2lvdXMgbWFubmVyLiBJdCB0cmFkZXMgYSBuZWdsaWJhYmxlIG92ZXJoZWFkIGluIGdlbmVyYWxcbiAgICogY2FzZSBmb3IgYSBsYXJnZSBzcGVlZHVwIGluIGNhc2Ugb2YgbWFwcGluZ3MgYmVpbmcgYWRkZWQgaW4gb3JkZXIuXG4gICAqL1xuICBmdW5jdGlvbiBNYXBwaW5nTGlzdCgpIHtcbiAgICB0aGlzLl9hcnJheSA9IFtdO1xuICAgIHRoaXMuX3NvcnRlZCA9IHRydWU7XG4gICAgLy8gU2VydmVzIGFzIGluZmltdW1cbiAgICB0aGlzLl9sYXN0ID0ge2dlbmVyYXRlZExpbmU6IC0xLCBnZW5lcmF0ZWRDb2x1bW46IDB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGUgdGhyb3VnaCBpbnRlcm5hbCBpdGVtcy4gVGhpcyBtZXRob2QgdGFrZXMgdGhlIHNhbWUgYXJndW1lbnRzIHRoYXRcbiAgICogYEFycmF5LnByb3RvdHlwZS5mb3JFYWNoYCB0YWtlcy5cbiAgICpcbiAgICogTk9URTogVGhlIG9yZGVyIG9mIHRoZSBtYXBwaW5ncyBpcyBOT1QgZ3VhcmFudGVlZC5cbiAgICovXG4gIE1hcHBpbmdMaXN0LnByb3RvdHlwZS51bnNvcnRlZEZvckVhY2ggPVxuICAgIGZ1bmN0aW9uIE1hcHBpbmdMaXN0X2ZvckVhY2goYUNhbGxiYWNrLCBhVGhpc0FyZykge1xuICAgICAgdGhpcy5fYXJyYXkuZm9yRWFjaChhQ2FsbGJhY2ssIGFUaGlzQXJnKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgdGhlIGdpdmVuIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gT2JqZWN0IGFNYXBwaW5nXG4gICAqL1xuICBNYXBwaW5nTGlzdC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gTWFwcGluZ0xpc3RfYWRkKGFNYXBwaW5nKSB7XG4gICAgdmFyIG1hcHBpbmc7XG4gICAgaWYgKGdlbmVyYXRlZFBvc2l0aW9uQWZ0ZXIodGhpcy5fbGFzdCwgYU1hcHBpbmcpKSB7XG4gICAgICB0aGlzLl9sYXN0ID0gYU1hcHBpbmc7XG4gICAgICB0aGlzLl9hcnJheS5wdXNoKGFNYXBwaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc29ydGVkID0gZmFsc2U7XG4gICAgICB0aGlzLl9hcnJheS5wdXNoKGFNYXBwaW5nKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGZsYXQsIHNvcnRlZCBhcnJheSBvZiBtYXBwaW5ncy4gVGhlIG1hcHBpbmdzIGFyZSBzb3J0ZWQgYnlcbiAgICogZ2VuZXJhdGVkIHBvc2l0aW9uLlxuICAgKlxuICAgKiBXQVJOSU5HOiBUaGlzIG1ldGhvZCByZXR1cm5zIGludGVybmFsIGRhdGEgd2l0aG91dCBjb3B5aW5nLCBmb3JcbiAgICogcGVyZm9ybWFuY2UuIFRoZSByZXR1cm4gdmFsdWUgbXVzdCBOT1QgYmUgbXV0YXRlZCwgYW5kIHNob3VsZCBiZSB0cmVhdGVkIGFzXG4gICAqIGFuIGltbXV0YWJsZSBib3Jyb3cuIElmIHlvdSB3YW50IHRvIHRha2Ugb3duZXJzaGlwLCB5b3UgbXVzdCBtYWtlIHlvdXIgb3duXG4gICAqIGNvcHkuXG4gICAqL1xuICBNYXBwaW5nTGlzdC5wcm90b3R5cGUudG9BcnJheSA9IGZ1bmN0aW9uIE1hcHBpbmdMaXN0X3RvQXJyYXkoKSB7XG4gICAgaWYgKCF0aGlzLl9zb3J0ZWQpIHtcbiAgICAgIHRoaXMuX2FycmF5LnNvcnQodXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNJbmZsYXRlZCk7XG4gICAgICB0aGlzLl9zb3J0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fYXJyYXk7XG4gIH07XG5cbiAgZXhwb3J0cy5NYXBwaW5nTGlzdCA9IE1hcHBpbmdMaXN0O1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgLy8gSXQgdHVybnMgb3V0IHRoYXQgc29tZSAobW9zdD8pIEphdmFTY3JpcHQgZW5naW5lcyBkb24ndCBzZWxmLWhvc3RcbiAgLy8gYEFycmF5LnByb3RvdHlwZS5zb3J0YC4gVGhpcyBtYWtlcyBzZW5zZSBiZWNhdXNlIEMrKyB3aWxsIGxpa2VseSByZW1haW5cbiAgLy8gZmFzdGVyIHRoYW4gSlMgd2hlbiBkb2luZyByYXcgQ1BVLWludGVuc2l2ZSBzb3J0aW5nLiBIb3dldmVyLCB3aGVuIHVzaW5nIGFcbiAgLy8gY3VzdG9tIGNvbXBhcmF0b3IgZnVuY3Rpb24sIGNhbGxpbmcgYmFjayBhbmQgZm9ydGggYmV0d2VlbiB0aGUgVk0ncyBDKysgYW5kXG4gIC8vIEpJVCdkIEpTIGlzIHJhdGhlciBzbG93ICphbmQqIGxvc2VzIEpJVCB0eXBlIGluZm9ybWF0aW9uLCByZXN1bHRpbmcgaW5cbiAgLy8gd29yc2UgZ2VuZXJhdGVkIGNvZGUgZm9yIHRoZSBjb21wYXJhdG9yIGZ1bmN0aW9uIHRoYW4gd291bGQgYmUgb3B0aW1hbC4gSW5cbiAgLy8gZmFjdCwgd2hlbiBzb3J0aW5nIHdpdGggYSBjb21wYXJhdG9yLCB0aGVzZSBjb3N0cyBvdXR3ZWlnaCB0aGUgYmVuZWZpdHMgb2ZcbiAgLy8gc29ydGluZyBpbiBDKysuIEJ5IHVzaW5nIG91ciBvd24gSlMtaW1wbGVtZW50ZWQgUXVpY2sgU29ydCAoYmVsb3cpLCB3ZSBnZXRcbiAgLy8gYSB+MzUwMG1zIG1lYW4gc3BlZWQtdXAgaW4gYGJlbmNoL2JlbmNoLmh0bWxgLlxuXG4gIC8qKlxuICAgKiBTd2FwIHRoZSBlbGVtZW50cyBpbmRleGVkIGJ5IGB4YCBhbmQgYHlgIGluIHRoZSBhcnJheSBgYXJ5YC5cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheX0gYXJ5XG4gICAqICAgICAgICBUaGUgYXJyYXkuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAqICAgICAgICBUaGUgaW5kZXggb2YgdGhlIGZpcnN0IGl0ZW0uXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gICAqICAgICAgICBUaGUgaW5kZXggb2YgdGhlIHNlY29uZCBpdGVtLlxuICAgKi9cbiAgZnVuY3Rpb24gc3dhcChhcnksIHgsIHkpIHtcbiAgICB2YXIgdGVtcCA9IGFyeVt4XTtcbiAgICBhcnlbeF0gPSBhcnlbeV07XG4gICAgYXJ5W3ldID0gdGVtcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcmFuZG9tIGludGVnZXIgd2l0aGluIHRoZSByYW5nZSBgbG93IC4uIGhpZ2hgIGluY2x1c2l2ZS5cbiAgICpcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxvd1xuICAgKiAgICAgICAgVGhlIGxvd2VyIGJvdW5kIG9uIHRoZSByYW5nZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGhpZ2hcbiAgICogICAgICAgIFRoZSB1cHBlciBib3VuZCBvbiB0aGUgcmFuZ2UuXG4gICAqL1xuICBmdW5jdGlvbiByYW5kb21JbnRJblJhbmdlKGxvdywgaGlnaCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKGxvdyArIChNYXRoLnJhbmRvbSgpICogKGhpZ2ggLSBsb3cpKSk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIFF1aWNrIFNvcnQgYWxnb3JpdGhtLlxuICAgKlxuICAgKiBAcGFyYW0ge0FycmF5fSBhcnlcbiAgICogICAgICAgIEFuIGFycmF5IHRvIHNvcnQuXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNvbXBhcmF0b3JcbiAgICogICAgICAgIEZ1bmN0aW9uIHRvIHVzZSB0byBjb21wYXJlIHR3byBpdGVtcy5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHBcbiAgICogICAgICAgIFN0YXJ0IGluZGV4IG9mIHRoZSBhcnJheVxuICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgKiAgICAgICAgRW5kIGluZGV4IG9mIHRoZSBhcnJheVxuICAgKi9cbiAgZnVuY3Rpb24gZG9RdWlja1NvcnQoYXJ5LCBjb21wYXJhdG9yLCBwLCByKSB7XG4gICAgLy8gSWYgb3VyIGxvd2VyIGJvdW5kIGlzIGxlc3MgdGhhbiBvdXIgdXBwZXIgYm91bmQsIHdlICgxKSBwYXJ0aXRpb24gdGhlXG4gICAgLy8gYXJyYXkgaW50byB0d28gcGllY2VzIGFuZCAoMikgcmVjdXJzZSBvbiBlYWNoIGhhbGYuIElmIGl0IGlzIG5vdCwgdGhpcyBpc1xuICAgIC8vIHRoZSBlbXB0eSBhcnJheSBhbmQgb3VyIGJhc2UgY2FzZS5cblxuICAgIGlmIChwIDwgcikge1xuICAgICAgLy8gKDEpIFBhcnRpdGlvbmluZy5cbiAgICAgIC8vXG4gICAgICAvLyBUaGUgcGFydGl0aW9uaW5nIGNob29zZXMgYSBwaXZvdCBiZXR3ZWVuIGBwYCBhbmQgYHJgIGFuZCBtb3ZlcyBhbGxcbiAgICAgIC8vIGVsZW1lbnRzIHRoYXQgYXJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byB0aGUgcGl2b3QgdG8gdGhlIGJlZm9yZSBpdCwgYW5kXG4gICAgICAvLyBhbGwgdGhlIGVsZW1lbnRzIHRoYXQgYXJlIGdyZWF0ZXIgdGhhbiBpdCBhZnRlciBpdC4gVGhlIGVmZmVjdCBpcyB0aGF0XG4gICAgICAvLyBvbmNlIHBhcnRpdGlvbiBpcyBkb25lLCB0aGUgcGl2b3QgaXMgaW4gdGhlIGV4YWN0IHBsYWNlIGl0IHdpbGwgYmUgd2hlblxuICAgICAgLy8gdGhlIGFycmF5IGlzIHB1dCBpbiBzb3J0ZWQgb3JkZXIsIGFuZCBpdCB3aWxsIG5vdCBuZWVkIHRvIGJlIG1vdmVkXG4gICAgICAvLyBhZ2Fpbi4gVGhpcyBydW5zIGluIE8obikgdGltZS5cblxuICAgICAgLy8gQWx3YXlzIGNob29zZSBhIHJhbmRvbSBwaXZvdCBzbyB0aGF0IGFuIGlucHV0IGFycmF5IHdoaWNoIGlzIHJldmVyc2VcbiAgICAgIC8vIHNvcnRlZCBkb2VzIG5vdCBjYXVzZSBPKG5eMikgcnVubmluZyB0aW1lLlxuICAgICAgdmFyIHBpdm90SW5kZXggPSByYW5kb21JbnRJblJhbmdlKHAsIHIpO1xuICAgICAgdmFyIGkgPSBwIC0gMTtcblxuICAgICAgc3dhcChhcnksIHBpdm90SW5kZXgsIHIpO1xuICAgICAgdmFyIHBpdm90ID0gYXJ5W3JdO1xuXG4gICAgICAvLyBJbW1lZGlhdGVseSBhZnRlciBgamAgaXMgaW5jcmVtZW50ZWQgaW4gdGhpcyBsb29wLCB0aGUgZm9sbG93aW5nIGhvbGRcbiAgICAgIC8vIHRydWU6XG4gICAgICAvL1xuICAgICAgLy8gICAqIEV2ZXJ5IGVsZW1lbnQgaW4gYGFyeVtwIC4uIGldYCBpcyBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gdGhlIHBpdm90LlxuICAgICAgLy9cbiAgICAgIC8vICAgKiBFdmVyeSBlbGVtZW50IGluIGBhcnlbaSsxIC4uIGotMV1gIGlzIGdyZWF0ZXIgdGhhbiB0aGUgcGl2b3QuXG4gICAgICBmb3IgKHZhciBqID0gcDsgaiA8IHI7IGorKykge1xuICAgICAgICBpZiAoY29tcGFyYXRvcihhcnlbal0sIHBpdm90KSA8PSAwKSB7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICAgIHN3YXAoYXJ5LCBpLCBqKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzd2FwKGFyeSwgaSArIDEsIGopO1xuICAgICAgdmFyIHEgPSBpICsgMTtcblxuICAgICAgLy8gKDIpIFJlY3Vyc2Ugb24gZWFjaCBoYWxmLlxuXG4gICAgICBkb1F1aWNrU29ydChhcnksIGNvbXBhcmF0b3IsIHAsIHEgLSAxKTtcbiAgICAgIGRvUXVpY2tTb3J0KGFyeSwgY29tcGFyYXRvciwgcSArIDEsIHIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTb3J0IHRoZSBnaXZlbiBhcnJheSBpbi1wbGFjZSB3aXRoIHRoZSBnaXZlbiBjb21wYXJhdG9yIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0ge0FycmF5fSBhcnlcbiAgICogICAgICAgIEFuIGFycmF5IHRvIHNvcnQuXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNvbXBhcmF0b3JcbiAgICogICAgICAgIEZ1bmN0aW9uIHRvIHVzZSB0byBjb21wYXJlIHR3byBpdGVtcy5cbiAgICovXG4gIGV4cG9ydHMucXVpY2tTb3J0ID0gZnVuY3Rpb24gKGFyeSwgY29tcGFyYXRvcikge1xuICAgIGRvUXVpY2tTb3J0KGFyeSwgY29tcGFyYXRvciwgMCwgYXJ5Lmxlbmd0aCAtIDEpO1xuICB9O1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbiAgdmFyIGJpbmFyeVNlYXJjaCA9IHJlcXVpcmUoJy4vYmluYXJ5LXNlYXJjaCcpO1xuICB2YXIgQXJyYXlTZXQgPSByZXF1aXJlKCcuL2FycmF5LXNldCcpLkFycmF5U2V0O1xuICB2YXIgYmFzZTY0VkxRID0gcmVxdWlyZSgnLi9iYXNlNjQtdmxxJyk7XG4gIHZhciBxdWlja1NvcnQgPSByZXF1aXJlKCcuL3F1aWNrLXNvcnQnKS5xdWlja1NvcnQ7XG5cbiAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXIoYVNvdXJjZU1hcCkge1xuICAgIHZhciBzb3VyY2VNYXAgPSBhU291cmNlTWFwO1xuICAgIGlmICh0eXBlb2YgYVNvdXJjZU1hcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHNvdXJjZU1hcCA9IEpTT04ucGFyc2UoYVNvdXJjZU1hcC5yZXBsYWNlKC9eXFwpXFxdXFx9Jy8sICcnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNvdXJjZU1hcC5zZWN0aW9ucyAhPSBudWxsXG4gICAgICA/IG5ldyBJbmRleGVkU291cmNlTWFwQ29uc3VtZXIoc291cmNlTWFwKVxuICAgICAgOiBuZXcgQmFzaWNTb3VyY2VNYXBDb25zdW1lcihzb3VyY2VNYXApO1xuICB9XG5cbiAgU291cmNlTWFwQ29uc3VtZXIuZnJvbVNvdXJjZU1hcCA9IGZ1bmN0aW9uKGFTb3VyY2VNYXApIHtcbiAgICByZXR1cm4gQmFzaWNTb3VyY2VNYXBDb25zdW1lci5mcm9tU291cmNlTWFwKGFTb3VyY2VNYXApO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSB2ZXJzaW9uIG9mIHRoZSBzb3VyY2UgbWFwcGluZyBzcGVjIHRoYXQgd2UgYXJlIGNvbnN1bWluZy5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fdmVyc2lvbiA9IDM7XG5cbiAgLy8gYF9fZ2VuZXJhdGVkTWFwcGluZ3NgIGFuZCBgX19vcmlnaW5hbE1hcHBpbmdzYCBhcmUgYXJyYXlzIHRoYXQgaG9sZCB0aGVcbiAgLy8gcGFyc2VkIG1hcHBpbmcgY29vcmRpbmF0ZXMgZnJvbSB0aGUgc291cmNlIG1hcCdzIFwibWFwcGluZ3NcIiBhdHRyaWJ1dGUuIFRoZXlcbiAgLy8gYXJlIGxhemlseSBpbnN0YW50aWF0ZWQsIGFjY2Vzc2VkIHZpYSB0aGUgYF9nZW5lcmF0ZWRNYXBwaW5nc2AgYW5kXG4gIC8vIGBfb3JpZ2luYWxNYXBwaW5nc2AgZ2V0dGVycyByZXNwZWN0aXZlbHksIGFuZCB3ZSBvbmx5IHBhcnNlIHRoZSBtYXBwaW5nc1xuICAvLyBhbmQgY3JlYXRlIHRoZXNlIGFycmF5cyBvbmNlIHF1ZXJpZWQgZm9yIGEgc291cmNlIGxvY2F0aW9uLiBXZSBqdW1wIHRocm91Z2hcbiAgLy8gdGhlc2UgaG9vcHMgYmVjYXVzZSB0aGVyZSBjYW4gYmUgbWFueSB0aG91c2FuZHMgb2YgbWFwcGluZ3MsIGFuZCBwYXJzaW5nXG4gIC8vIHRoZW0gaXMgZXhwZW5zaXZlLCBzbyB3ZSBvbmx5IHdhbnQgdG8gZG8gaXQgaWYgd2UgbXVzdC5cbiAgLy9cbiAgLy8gRWFjaCBvYmplY3QgaW4gdGhlIGFycmF5cyBpcyBvZiB0aGUgZm9ybTpcbiAgLy9cbiAgLy8gICAgIHtcbiAgLy8gICAgICAgZ2VuZXJhdGVkTGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgY29kZSxcbiAgLy8gICAgICAgZ2VuZXJhdGVkQ29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUsXG4gIC8vICAgICAgIHNvdXJjZTogVGhlIHBhdGggdG8gdGhlIG9yaWdpbmFsIHNvdXJjZSBmaWxlIHRoYXQgZ2VuZXJhdGVkIHRoaXNcbiAgLy8gICAgICAgICAgICAgICBjaHVuayBvZiBjb2RlLFxuICAvLyAgICAgICBvcmlnaW5hbExpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlIHRoYXRcbiAgLy8gICAgICAgICAgICAgICAgICAgICBjb3JyZXNwb25kcyB0byB0aGlzIGNodW5rIG9mIGdlbmVyYXRlZCBjb2RlLFxuICAvLyAgICAgICBvcmlnaW5hbENvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZSB0aGF0XG4gIC8vICAgICAgICAgICAgICAgICAgICAgICBjb3JyZXNwb25kcyB0byB0aGlzIGNodW5rIG9mIGdlbmVyYXRlZCBjb2RlLFxuICAvLyAgICAgICBuYW1lOiBUaGUgbmFtZSBvZiB0aGUgb3JpZ2luYWwgc3ltYm9sIHdoaWNoIGdlbmVyYXRlZCB0aGlzIGNodW5rIG9mXG4gIC8vICAgICAgICAgICAgIGNvZGUuXG4gIC8vICAgICB9XG4gIC8vXG4gIC8vIEFsbCBwcm9wZXJ0aWVzIGV4Y2VwdCBmb3IgYGdlbmVyYXRlZExpbmVgIGFuZCBgZ2VuZXJhdGVkQ29sdW1uYCBjYW4gYmVcbiAgLy8gYG51bGxgLlxuICAvL1xuICAvLyBgX2dlbmVyYXRlZE1hcHBpbmdzYCBpcyBvcmRlcmVkIGJ5IHRoZSBnZW5lcmF0ZWQgcG9zaXRpb25zLlxuICAvL1xuICAvLyBgX29yaWdpbmFsTWFwcGluZ3NgIGlzIG9yZGVyZWQgYnkgdGhlIG9yaWdpbmFsIHBvc2l0aW9ucy5cblxuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuX19nZW5lcmF0ZWRNYXBwaW5ncyA9IG51bGw7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUsICdfZ2VuZXJhdGVkTWFwcGluZ3MnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIXRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncykge1xuICAgICAgICB0aGlzLl9wYXJzZU1hcHBpbmdzKHRoaXMuX21hcHBpbmdzLCB0aGlzLnNvdXJjZVJvb3QpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzO1xuICAgIH1cbiAgfSk7XG5cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl9fb3JpZ2luYWxNYXBwaW5ncyA9IG51bGw7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUsICdfb3JpZ2luYWxNYXBwaW5ncycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghdGhpcy5fX29yaWdpbmFsTWFwcGluZ3MpIHtcbiAgICAgICAgdGhpcy5fcGFyc2VNYXBwaW5ncyh0aGlzLl9tYXBwaW5ncywgdGhpcy5zb3VyY2VSb290KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuX19vcmlnaW5hbE1hcHBpbmdzO1xuICAgIH1cbiAgfSk7XG5cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl9jaGFySXNNYXBwaW5nU2VwYXJhdG9yID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9jaGFySXNNYXBwaW5nU2VwYXJhdG9yKGFTdHIsIGluZGV4KSB7XG4gICAgICB2YXIgYyA9IGFTdHIuY2hhckF0KGluZGV4KTtcbiAgICAgIHJldHVybiBjID09PSBcIjtcIiB8fCBjID09PSBcIixcIjtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBQYXJzZSB0aGUgbWFwcGluZ3MgaW4gYSBzdHJpbmcgaW4gdG8gYSBkYXRhIHN0cnVjdHVyZSB3aGljaCB3ZSBjYW4gZWFzaWx5XG4gICAqIHF1ZXJ5ICh0aGUgb3JkZXJlZCBhcnJheXMgaW4gdGhlIGB0aGlzLl9fZ2VuZXJhdGVkTWFwcGluZ3NgIGFuZFxuICAgKiBgdGhpcy5fX29yaWdpbmFsTWFwcGluZ3NgIHByb3BlcnRpZXMpLlxuICAgKi9cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl9wYXJzZU1hcHBpbmdzID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9wYXJzZU1hcHBpbmdzKGFTdHIsIGFTb3VyY2VSb290KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTdWJjbGFzc2VzIG11c3QgaW1wbGVtZW50IF9wYXJzZU1hcHBpbmdzXCIpO1xuICAgIH07XG5cbiAgU291cmNlTWFwQ29uc3VtZXIuR0VORVJBVEVEX09SREVSID0gMTtcbiAgU291cmNlTWFwQ29uc3VtZXIuT1JJR0lOQUxfT1JERVIgPSAyO1xuXG4gIFNvdXJjZU1hcENvbnN1bWVyLkdSRUFURVNUX0xPV0VSX0JPVU5EID0gMTtcbiAgU291cmNlTWFwQ29uc3VtZXIuTEVBU1RfVVBQRVJfQk9VTkQgPSAyO1xuXG4gIC8qKlxuICAgKiBJdGVyYXRlIG92ZXIgZWFjaCBtYXBwaW5nIGJldHdlZW4gYW4gb3JpZ2luYWwgc291cmNlL2xpbmUvY29sdW1uIGFuZCBhXG4gICAqIGdlbmVyYXRlZCBsaW5lL2NvbHVtbiBpbiB0aGlzIHNvdXJjZSBtYXAuXG4gICAqXG4gICAqIEBwYXJhbSBGdW5jdGlvbiBhQ2FsbGJhY2tcbiAgICogICAgICAgIFRoZSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aXRoIGVhY2ggbWFwcGluZy5cbiAgICogQHBhcmFtIE9iamVjdCBhQ29udGV4dFxuICAgKiAgICAgICAgT3B0aW9uYWwuIElmIHNwZWNpZmllZCwgdGhpcyBvYmplY3Qgd2lsbCBiZSB0aGUgdmFsdWUgb2YgYHRoaXNgIGV2ZXJ5XG4gICAqICAgICAgICB0aW1lIHRoYXQgYGFDYWxsYmFja2AgaXMgY2FsbGVkLlxuICAgKiBAcGFyYW0gYU9yZGVyXG4gICAqICAgICAgICBFaXRoZXIgYFNvdXJjZU1hcENvbnN1bWVyLkdFTkVSQVRFRF9PUkRFUmAgb3JcbiAgICogICAgICAgIGBTb3VyY2VNYXBDb25zdW1lci5PUklHSU5BTF9PUkRFUmAuIFNwZWNpZmllcyB3aGV0aGVyIHlvdSB3YW50IHRvXG4gICAqICAgICAgICBpdGVyYXRlIG92ZXIgdGhlIG1hcHBpbmdzIHNvcnRlZCBieSB0aGUgZ2VuZXJhdGVkIGZpbGUncyBsaW5lL2NvbHVtblxuICAgKiAgICAgICAgb3JkZXIgb3IgdGhlIG9yaWdpbmFsJ3Mgc291cmNlL2xpbmUvY29sdW1uIG9yZGVyLCByZXNwZWN0aXZlbHkuIERlZmF1bHRzIHRvXG4gICAqICAgICAgICBgU291cmNlTWFwQ29uc3VtZXIuR0VORVJBVEVEX09SREVSYC5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5lYWNoTWFwcGluZyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfZWFjaE1hcHBpbmcoYUNhbGxiYWNrLCBhQ29udGV4dCwgYU9yZGVyKSB7XG4gICAgICB2YXIgY29udGV4dCA9IGFDb250ZXh0IHx8IG51bGw7XG4gICAgICB2YXIgb3JkZXIgPSBhT3JkZXIgfHwgU291cmNlTWFwQ29uc3VtZXIuR0VORVJBVEVEX09SREVSO1xuXG4gICAgICB2YXIgbWFwcGluZ3M7XG4gICAgICBzd2l0Y2ggKG9yZGVyKSB7XG4gICAgICBjYXNlIFNvdXJjZU1hcENvbnN1bWVyLkdFTkVSQVRFRF9PUkRFUjpcbiAgICAgICAgbWFwcGluZ3MgPSB0aGlzLl9nZW5lcmF0ZWRNYXBwaW5ncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFNvdXJjZU1hcENvbnN1bWVyLk9SSUdJTkFMX09SREVSOlxuICAgICAgICBtYXBwaW5ncyA9IHRoaXMuX29yaWdpbmFsTWFwcGluZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBvcmRlciBvZiBpdGVyYXRpb24uXCIpO1xuICAgICAgfVxuXG4gICAgICB2YXIgc291cmNlUm9vdCA9IHRoaXMuc291cmNlUm9vdDtcbiAgICAgIG1hcHBpbmdzLm1hcChmdW5jdGlvbiAobWFwcGluZykge1xuICAgICAgICB2YXIgc291cmNlID0gbWFwcGluZy5zb3VyY2UgPT09IG51bGwgPyBudWxsIDogdGhpcy5fc291cmNlcy5hdChtYXBwaW5nLnNvdXJjZSk7XG4gICAgICAgIGlmIChzb3VyY2UgIT0gbnVsbCAmJiBzb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgICBzb3VyY2UgPSB1dGlsLmpvaW4oc291cmNlUm9vdCwgc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGdlbmVyYXRlZExpbmU6IG1hcHBpbmcuZ2VuZXJhdGVkTGluZSxcbiAgICAgICAgICBnZW5lcmF0ZWRDb2x1bW46IG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uLFxuICAgICAgICAgIG9yaWdpbmFsTGluZTogbWFwcGluZy5vcmlnaW5hbExpbmUsXG4gICAgICAgICAgb3JpZ2luYWxDb2x1bW46IG1hcHBpbmcub3JpZ2luYWxDb2x1bW4sXG4gICAgICAgICAgbmFtZTogbWFwcGluZy5uYW1lID09PSBudWxsID8gbnVsbCA6IHRoaXMuX25hbWVzLmF0KG1hcHBpbmcubmFtZSlcbiAgICAgICAgfTtcbiAgICAgIH0sIHRoaXMpLmZvckVhY2goYUNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFsbCBnZW5lcmF0ZWQgbGluZSBhbmQgY29sdW1uIGluZm9ybWF0aW9uIGZvciB0aGUgb3JpZ2luYWwgc291cmNlLFxuICAgKiBsaW5lLCBhbmQgY29sdW1uIHByb3ZpZGVkLiBJZiBubyBjb2x1bW4gaXMgcHJvdmlkZWQsIHJldHVybnMgYWxsIG1hcHBpbmdzXG4gICAqIGNvcnJlc3BvbmRpbmcgdG8gYSBlaXRoZXIgdGhlIGxpbmUgd2UgYXJlIHNlYXJjaGluZyBmb3Igb3IgdGhlIG5leHRcbiAgICogY2xvc2VzdCBsaW5lIHRoYXQgaGFzIGFueSBtYXBwaW5ncy4gT3RoZXJ3aXNlLCByZXR1cm5zIGFsbCBtYXBwaW5nc1xuICAgKiBjb3JyZXNwb25kaW5nIHRvIHRoZSBnaXZlbiBsaW5lIGFuZCBlaXRoZXIgdGhlIGNvbHVtbiB3ZSBhcmUgc2VhcmNoaW5nIGZvclxuICAgKiBvciB0aGUgbmV4dCBjbG9zZXN0IGNvbHVtbiB0aGF0IGhhcyBhbnkgb2Zmc2V0cy5cbiAgICpcbiAgICogVGhlIG9ubHkgYXJndW1lbnQgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gc291cmNlOiBUaGUgZmlsZW5hbWUgb2YgdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLlxuICAgKiAgIC0gY29sdW1uOiBPcHRpb25hbC4gdGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICpcbiAgICogYW5kIGFuIGFycmF5IG9mIG9iamVjdHMgaXMgcmV0dXJuZWQsIGVhY2ggd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBsaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UsIG9yIG51bGwuXG4gICAqICAgLSBjb2x1bW46IFRoZSBjb2x1bW4gbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLCBvciBudWxsLlxuICAgKi9cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLmFsbEdlbmVyYXRlZFBvc2l0aW9uc0ZvciA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfYWxsR2VuZXJhdGVkUG9zaXRpb25zRm9yKGFBcmdzKSB7XG4gICAgICB2YXIgbGluZSA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnbGluZScpO1xuXG4gICAgICAvLyBXaGVuIHRoZXJlIGlzIG5vIGV4YWN0IG1hdGNoLCBCYXNpY1NvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fZmluZE1hcHBpbmdcbiAgICAgIC8vIHJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBjbG9zZXN0IG1hcHBpbmcgbGVzcyB0aGFuIHRoZSBuZWVkbGUuIEJ5XG4gICAgICAvLyBzZXR0aW5nIG5lZWRsZS5vcmlnaW5hbENvbHVtbiB0byAwLCB3ZSB0aHVzIGZpbmQgdGhlIGxhc3QgbWFwcGluZyBmb3JcbiAgICAgIC8vIHRoZSBnaXZlbiBsaW5lLCBwcm92aWRlZCBzdWNoIGEgbWFwcGluZyBleGlzdHMuXG4gICAgICB2YXIgbmVlZGxlID0ge1xuICAgICAgICBzb3VyY2U6IHV0aWwuZ2V0QXJnKGFBcmdzLCAnc291cmNlJyksXG4gICAgICAgIG9yaWdpbmFsTGluZTogbGluZSxcbiAgICAgICAgb3JpZ2luYWxDb2x1bW46IHV0aWwuZ2V0QXJnKGFBcmdzLCAnY29sdW1uJywgMClcbiAgICAgIH07XG5cbiAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBuZWVkbGUuc291cmNlID0gdXRpbC5yZWxhdGl2ZSh0aGlzLnNvdXJjZVJvb3QsIG5lZWRsZS5zb3VyY2UpO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLl9zb3VyY2VzLmhhcyhuZWVkbGUuc291cmNlKSkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgICBuZWVkbGUuc291cmNlID0gdGhpcy5fc291cmNlcy5pbmRleE9mKG5lZWRsZS5zb3VyY2UpO1xuXG4gICAgICB2YXIgbWFwcGluZ3MgPSBbXTtcblxuICAgICAgdmFyIGluZGV4ID0gdGhpcy5fZmluZE1hcHBpbmcobmVlZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3JpZ2luYWxNYXBwaW5ncyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwib3JpZ2luYWxMaW5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm9yaWdpbmFsQ29sdW1uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluYXJ5U2VhcmNoLkxFQVNUX1VQUEVSX0JPVU5EKTtcbiAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgIHZhciBtYXBwaW5nID0gdGhpcy5fb3JpZ2luYWxNYXBwaW5nc1tpbmRleF07XG5cbiAgICAgICAgaWYgKGFBcmdzLmNvbHVtbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFyIG9yaWdpbmFsTGluZSA9IG1hcHBpbmcub3JpZ2luYWxMaW5lO1xuXG4gICAgICAgICAgLy8gSXRlcmF0ZSB1bnRpbCBlaXRoZXIgd2UgcnVuIG91dCBvZiBtYXBwaW5ncywgb3Igd2UgcnVuIGludG9cbiAgICAgICAgICAvLyBhIG1hcHBpbmcgZm9yIGEgZGlmZmVyZW50IGxpbmUgdGhhbiB0aGUgb25lIHdlIGZvdW5kLiBTaW5jZVxuICAgICAgICAgIC8vIG1hcHBpbmdzIGFyZSBzb3J0ZWQsIHRoaXMgaXMgZ3VhcmFudGVlZCB0byBmaW5kIGFsbCBtYXBwaW5ncyBmb3JcbiAgICAgICAgICAvLyB0aGUgbGluZSB3ZSBmb3VuZC5cbiAgICAgICAgICB3aGlsZSAobWFwcGluZyAmJiBtYXBwaW5nLm9yaWdpbmFsTGluZSA9PT0gb3JpZ2luYWxMaW5lKSB7XG4gICAgICAgICAgICBtYXBwaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgbGluZTogdXRpbC5nZXRBcmcobWFwcGluZywgJ2dlbmVyYXRlZExpbmUnLCBudWxsKSxcbiAgICAgICAgICAgICAgY29sdW1uOiB1dGlsLmdldEFyZyhtYXBwaW5nLCAnZ2VuZXJhdGVkQ29sdW1uJywgbnVsbCksXG4gICAgICAgICAgICAgIGxhc3RDb2x1bW46IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdsYXN0R2VuZXJhdGVkQ29sdW1uJywgbnVsbClcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBtYXBwaW5nID0gdGhpcy5fb3JpZ2luYWxNYXBwaW5nc1srK2luZGV4XTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG9yaWdpbmFsQ29sdW1uID0gbWFwcGluZy5vcmlnaW5hbENvbHVtbjtcblxuICAgICAgICAgIC8vIEl0ZXJhdGUgdW50aWwgZWl0aGVyIHdlIHJ1biBvdXQgb2YgbWFwcGluZ3MsIG9yIHdlIHJ1biBpbnRvXG4gICAgICAgICAgLy8gYSBtYXBwaW5nIGZvciBhIGRpZmZlcmVudCBsaW5lIHRoYW4gdGhlIG9uZSB3ZSB3ZXJlIHNlYXJjaGluZyBmb3IuXG4gICAgICAgICAgLy8gU2luY2UgbWFwcGluZ3MgYXJlIHNvcnRlZCwgdGhpcyBpcyBndWFyYW50ZWVkIHRvIGZpbmQgYWxsIG1hcHBpbmdzIGZvclxuICAgICAgICAgIC8vIHRoZSBsaW5lIHdlIGFyZSBzZWFyY2hpbmcgZm9yLlxuICAgICAgICAgIHdoaWxlIChtYXBwaW5nICYmXG4gICAgICAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxMaW5lID09PSBsaW5lICYmXG4gICAgICAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxDb2x1bW4gPT0gb3JpZ2luYWxDb2x1bW4pIHtcbiAgICAgICAgICAgIG1hcHBpbmdzLnB1c2goe1xuICAgICAgICAgICAgICBsaW5lOiB1dGlsLmdldEFyZyhtYXBwaW5nLCAnZ2VuZXJhdGVkTGluZScsIG51bGwpLFxuICAgICAgICAgICAgICBjb2x1bW46IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdnZW5lcmF0ZWRDb2x1bW4nLCBudWxsKSxcbiAgICAgICAgICAgICAgbGFzdENvbHVtbjogdXRpbC5nZXRBcmcobWFwcGluZywgJ2xhc3RHZW5lcmF0ZWRDb2x1bW4nLCBudWxsKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIG1hcHBpbmcgPSB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzWysraW5kZXhdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWFwcGluZ3M7XG4gICAgfTtcblxuICBleHBvcnRzLlNvdXJjZU1hcENvbnN1bWVyID0gU291cmNlTWFwQ29uc3VtZXI7XG5cbiAgLyoqXG4gICAqIEEgQmFzaWNTb3VyY2VNYXBDb25zdW1lciBpbnN0YW5jZSByZXByZXNlbnRzIGEgcGFyc2VkIHNvdXJjZSBtYXAgd2hpY2ggd2UgY2FuXG4gICAqIHF1ZXJ5IGZvciBpbmZvcm1hdGlvbiBhYm91dCB0aGUgb3JpZ2luYWwgZmlsZSBwb3NpdGlvbnMgYnkgZ2l2aW5nIGl0IGEgZmlsZVxuICAgKiBwb3NpdGlvbiBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZS5cbiAgICpcbiAgICogVGhlIG9ubHkgcGFyYW1ldGVyIGlzIHRoZSByYXcgc291cmNlIG1hcCAoZWl0aGVyIGFzIGEgSlNPTiBzdHJpbmcsIG9yXG4gICAqIGFscmVhZHkgcGFyc2VkIHRvIGFuIG9iamVjdCkuIEFjY29yZGluZyB0byB0aGUgc3BlYywgc291cmNlIG1hcHMgaGF2ZSB0aGVcbiAgICogZm9sbG93aW5nIGF0dHJpYnV0ZXM6XG4gICAqXG4gICAqICAgLSB2ZXJzaW9uOiBXaGljaCB2ZXJzaW9uIG9mIHRoZSBzb3VyY2UgbWFwIHNwZWMgdGhpcyBtYXAgaXMgZm9sbG93aW5nLlxuICAgKiAgIC0gc291cmNlczogQW4gYXJyYXkgb2YgVVJMcyB0byB0aGUgb3JpZ2luYWwgc291cmNlIGZpbGVzLlxuICAgKiAgIC0gbmFtZXM6IEFuIGFycmF5IG9mIGlkZW50aWZpZXJzIHdoaWNoIGNhbiBiZSByZWZlcnJlbmNlZCBieSBpbmRpdmlkdWFsIG1hcHBpbmdzLlxuICAgKiAgIC0gc291cmNlUm9vdDogT3B0aW9uYWwuIFRoZSBVUkwgcm9vdCBmcm9tIHdoaWNoIGFsbCBzb3VyY2VzIGFyZSByZWxhdGl2ZS5cbiAgICogICAtIHNvdXJjZXNDb250ZW50OiBPcHRpb25hbC4gQW4gYXJyYXkgb2YgY29udGVudHMgb2YgdGhlIG9yaWdpbmFsIHNvdXJjZSBmaWxlcy5cbiAgICogICAtIG1hcHBpbmdzOiBBIHN0cmluZyBvZiBiYXNlNjQgVkxRcyB3aGljaCBjb250YWluIHRoZSBhY3R1YWwgbWFwcGluZ3MuXG4gICAqICAgLSBmaWxlOiBPcHRpb25hbC4gVGhlIGdlbmVyYXRlZCBmaWxlIHRoaXMgc291cmNlIG1hcCBpcyBhc3NvY2lhdGVkIHdpdGguXG4gICAqXG4gICAqIEhlcmUgaXMgYW4gZXhhbXBsZSBzb3VyY2UgbWFwLCB0YWtlbiBmcm9tIHRoZSBzb3VyY2UgbWFwIHNwZWNbMF06XG4gICAqXG4gICAqICAgICB7XG4gICAqICAgICAgIHZlcnNpb24gOiAzLFxuICAgKiAgICAgICBmaWxlOiBcIm91dC5qc1wiLFxuICAgKiAgICAgICBzb3VyY2VSb290IDogXCJcIixcbiAgICogICAgICAgc291cmNlczogW1wiZm9vLmpzXCIsIFwiYmFyLmpzXCJdLFxuICAgKiAgICAgICBuYW1lczogW1wic3JjXCIsIFwibWFwc1wiLCBcImFyZVwiLCBcImZ1blwiXSxcbiAgICogICAgICAgbWFwcGluZ3M6IFwiQUEsQUI7O0FCQ0RFO1wiXG4gICAqICAgICB9XG4gICAqXG4gICAqIFswXTogaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vZG9jdW1lbnQvZC8xVTFSR0FlaFF3UnlwVVRvdkYxS1JscGlPRnplMGItXzJnYzZmQUgwS1kway9lZGl0P3BsaT0xI1xuICAgKi9cbiAgZnVuY3Rpb24gQmFzaWNTb3VyY2VNYXBDb25zdW1lcihhU291cmNlTWFwKSB7XG4gICAgdmFyIHNvdXJjZU1hcCA9IGFTb3VyY2VNYXA7XG4gICAgaWYgKHR5cGVvZiBhU291cmNlTWFwID09PSAnc3RyaW5nJykge1xuICAgICAgc291cmNlTWFwID0gSlNPTi5wYXJzZShhU291cmNlTWFwLnJlcGxhY2UoL15cXClcXF1cXH0nLywgJycpKTtcbiAgICB9XG5cbiAgICB2YXIgdmVyc2lvbiA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ3ZlcnNpb24nKTtcbiAgICB2YXIgc291cmNlcyA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ3NvdXJjZXMnKTtcbiAgICAvLyBTYXNzIDMuMyBsZWF2ZXMgb3V0IHRoZSAnbmFtZXMnIGFycmF5LCBzbyB3ZSBkZXZpYXRlIGZyb20gdGhlIHNwZWMgKHdoaWNoXG4gICAgLy8gcmVxdWlyZXMgdGhlIGFycmF5KSB0byBwbGF5IG5pY2UgaGVyZS5cbiAgICB2YXIgbmFtZXMgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICduYW1lcycsIFtdKTtcbiAgICB2YXIgc291cmNlUm9vdCA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ3NvdXJjZVJvb3QnLCBudWxsKTtcbiAgICB2YXIgc291cmNlc0NvbnRlbnQgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICdzb3VyY2VzQ29udGVudCcsIG51bGwpO1xuICAgIHZhciBtYXBwaW5ncyA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ21hcHBpbmdzJyk7XG4gICAgdmFyIGZpbGUgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICdmaWxlJywgbnVsbCk7XG5cbiAgICAvLyBPbmNlIGFnYWluLCBTYXNzIGRldmlhdGVzIGZyb20gdGhlIHNwZWMgYW5kIHN1cHBsaWVzIHRoZSB2ZXJzaW9uIGFzIGFcbiAgICAvLyBzdHJpbmcgcmF0aGVyIHRoYW4gYSBudW1iZXIsIHNvIHdlIHVzZSBsb29zZSBlcXVhbGl0eSBjaGVja2luZyBoZXJlLlxuICAgIGlmICh2ZXJzaW9uICE9IHRoaXMuX3ZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgdmVyc2lvbjogJyArIHZlcnNpb24pO1xuICAgIH1cblxuICAgIC8vIFNvbWUgc291cmNlIG1hcHMgcHJvZHVjZSByZWxhdGl2ZSBzb3VyY2UgcGF0aHMgbGlrZSBcIi4vZm9vLmpzXCIgaW5zdGVhZCBvZlxuICAgIC8vIFwiZm9vLmpzXCIuICBOb3JtYWxpemUgdGhlc2UgZmlyc3Qgc28gdGhhdCBmdXR1cmUgY29tcGFyaXNvbnMgd2lsbCBzdWNjZWVkLlxuICAgIC8vIFNlZSBidWd6aWwubGEvMTA5MDc2OC5cbiAgICBzb3VyY2VzID0gc291cmNlcy5tYXAodXRpbC5ub3JtYWxpemUpO1xuXG4gICAgLy8gUGFzcyBgdHJ1ZWAgYmVsb3cgdG8gYWxsb3cgZHVwbGljYXRlIG5hbWVzIGFuZCBzb3VyY2VzLiBXaGlsZSBzb3VyY2UgbWFwc1xuICAgIC8vIGFyZSBpbnRlbmRlZCB0byBiZSBjb21wcmVzc2VkIGFuZCBkZWR1cGxpY2F0ZWQsIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGVyXG4gICAgLy8gc29tZXRpbWVzIGdlbmVyYXRlcyBzb3VyY2UgbWFwcyB3aXRoIGR1cGxpY2F0ZXMgaW4gdGhlbS4gU2VlIEdpdGh1YiBpc3N1ZVxuICAgIC8vICM3MiBhbmQgYnVnemlsLmxhLzg4OTQ5Mi5cbiAgICB0aGlzLl9uYW1lcyA9IEFycmF5U2V0LmZyb21BcnJheShuYW1lcywgdHJ1ZSk7XG4gICAgdGhpcy5fc291cmNlcyA9IEFycmF5U2V0LmZyb21BcnJheShzb3VyY2VzLCB0cnVlKTtcblxuICAgIHRoaXMuc291cmNlUm9vdCA9IHNvdXJjZVJvb3Q7XG4gICAgdGhpcy5zb3VyY2VzQ29udGVudCA9IHNvdXJjZXNDb250ZW50O1xuICAgIHRoaXMuX21hcHBpbmdzID0gbWFwcGluZ3M7XG4gICAgdGhpcy5maWxlID0gZmlsZTtcbiAgfVxuXG4gIEJhc2ljU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUpO1xuICBCYXNpY1NvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5jb25zdW1lciA9IFNvdXJjZU1hcENvbnN1bWVyO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBCYXNpY1NvdXJjZU1hcENvbnN1bWVyIGZyb20gYSBTb3VyY2VNYXBHZW5lcmF0b3IuXG4gICAqXG4gICAqIEBwYXJhbSBTb3VyY2VNYXBHZW5lcmF0b3IgYVNvdXJjZU1hcFxuICAgKiAgICAgICAgVGhlIHNvdXJjZSBtYXAgdGhhdCB3aWxsIGJlIGNvbnN1bWVkLlxuICAgKiBAcmV0dXJucyBCYXNpY1NvdXJjZU1hcENvbnN1bWVyXG4gICAqL1xuICBCYXNpY1NvdXJjZU1hcENvbnN1bWVyLmZyb21Tb3VyY2VNYXAgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2Zyb21Tb3VyY2VNYXAoYVNvdXJjZU1hcCkge1xuICAgICAgdmFyIHNtYyA9IE9iamVjdC5jcmVhdGUoQmFzaWNTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUpO1xuXG4gICAgICB2YXIgbmFtZXMgPSBzbWMuX25hbWVzID0gQXJyYXlTZXQuZnJvbUFycmF5KGFTb3VyY2VNYXAuX25hbWVzLnRvQXJyYXkoKSwgdHJ1ZSk7XG4gICAgICB2YXIgc291cmNlcyA9IHNtYy5fc291cmNlcyA9IEFycmF5U2V0LmZyb21BcnJheShhU291cmNlTWFwLl9zb3VyY2VzLnRvQXJyYXkoKSwgdHJ1ZSk7XG4gICAgICBzbWMuc291cmNlUm9vdCA9IGFTb3VyY2VNYXAuX3NvdXJjZVJvb3Q7XG4gICAgICBzbWMuc291cmNlc0NvbnRlbnQgPSBhU291cmNlTWFwLl9nZW5lcmF0ZVNvdXJjZXNDb250ZW50KHNtYy5fc291cmNlcy50b0FycmF5KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNtYy5zb3VyY2VSb290KTtcbiAgICAgIHNtYy5maWxlID0gYVNvdXJjZU1hcC5fZmlsZTtcblxuICAgICAgLy8gQmVjYXVzZSB3ZSBhcmUgbW9kaWZ5aW5nIHRoZSBlbnRyaWVzIChieSBjb252ZXJ0aW5nIHN0cmluZyBzb3VyY2VzIGFuZFxuICAgICAgLy8gbmFtZXMgdG8gaW5kaWNlcyBpbnRvIHRoZSBzb3VyY2VzIGFuZCBuYW1lcyBBcnJheVNldHMpLCB3ZSBoYXZlIHRvIG1ha2VcbiAgICAgIC8vIGEgY29weSBvZiB0aGUgZW50cnkgb3IgZWxzZSBiYWQgdGhpbmdzIGhhcHBlbi4gU2hhcmVkIG11dGFibGUgc3RhdGVcbiAgICAgIC8vIHN0cmlrZXMgYWdhaW4hIFNlZSBnaXRodWIgaXNzdWUgIzE5MS5cblxuICAgICAgdmFyIGdlbmVyYXRlZE1hcHBpbmdzID0gYVNvdXJjZU1hcC5fbWFwcGluZ3MudG9BcnJheSgpLnNsaWNlKCk7XG4gICAgICB2YXIgZGVzdEdlbmVyYXRlZE1hcHBpbmdzID0gc21jLl9fZ2VuZXJhdGVkTWFwcGluZ3MgPSBbXTtcbiAgICAgIHZhciBkZXN0T3JpZ2luYWxNYXBwaW5ncyA9IHNtYy5fX29yaWdpbmFsTWFwcGluZ3MgPSBbXTtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGdlbmVyYXRlZE1hcHBpbmdzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzcmNNYXBwaW5nID0gZ2VuZXJhdGVkTWFwcGluZ3NbaV07XG4gICAgICAgIHZhciBkZXN0TWFwcGluZyA9IG5ldyBNYXBwaW5nO1xuICAgICAgICBkZXN0TWFwcGluZy5nZW5lcmF0ZWRMaW5lID0gc3JjTWFwcGluZy5nZW5lcmF0ZWRMaW5lO1xuICAgICAgICBkZXN0TWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4gPSBzcmNNYXBwaW5nLmdlbmVyYXRlZENvbHVtbjtcblxuICAgICAgICBpZiAoc3JjTWFwcGluZy5zb3VyY2UpIHtcbiAgICAgICAgICBkZXN0TWFwcGluZy5zb3VyY2UgPSBzb3VyY2VzLmluZGV4T2Yoc3JjTWFwcGluZy5zb3VyY2UpO1xuICAgICAgICAgIGRlc3RNYXBwaW5nLm9yaWdpbmFsTGluZSA9IHNyY01hcHBpbmcub3JpZ2luYWxMaW5lO1xuICAgICAgICAgIGRlc3RNYXBwaW5nLm9yaWdpbmFsQ29sdW1uID0gc3JjTWFwcGluZy5vcmlnaW5hbENvbHVtbjtcblxuICAgICAgICAgIGlmIChzcmNNYXBwaW5nLm5hbWUpIHtcbiAgICAgICAgICAgIGRlc3RNYXBwaW5nLm5hbWUgPSBuYW1lcy5pbmRleE9mKHNyY01hcHBpbmcubmFtZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGVzdE9yaWdpbmFsTWFwcGluZ3MucHVzaChkZXN0TWFwcGluZyk7XG4gICAgICAgIH1cblxuICAgICAgICBkZXN0R2VuZXJhdGVkTWFwcGluZ3MucHVzaChkZXN0TWFwcGluZyk7XG4gICAgICB9XG5cbiAgICAgIHF1aWNrU29ydChzbWMuX19vcmlnaW5hbE1hcHBpbmdzLCB1dGlsLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zKTtcblxuICAgICAgcmV0dXJuIHNtYztcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBUaGUgdmVyc2lvbiBvZiB0aGUgc291cmNlIG1hcHBpbmcgc3BlYyB0aGF0IHdlIGFyZSBjb25zdW1pbmcuXG4gICAqL1xuICBCYXNpY1NvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fdmVyc2lvbiA9IDM7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIG9yaWdpbmFsIHNvdXJjZXMuXG4gICAqL1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzaWNTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUsICdzb3VyY2VzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3NvdXJjZXMudG9BcnJheSgpLm1hcChmdW5jdGlvbiAocykge1xuICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2VSb290ICE9IG51bGwgPyB1dGlsLmpvaW4odGhpcy5zb3VyY2VSb290LCBzKSA6IHM7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBQcm92aWRlIHRoZSBKSVQgd2l0aCBhIG5pY2Ugc2hhcGUgLyBoaWRkZW4gY2xhc3MuXG4gICAqL1xuICBmdW5jdGlvbiBNYXBwaW5nKCkge1xuICAgIHRoaXMuZ2VuZXJhdGVkTGluZSA9IDA7XG4gICAgdGhpcy5nZW5lcmF0ZWRDb2x1bW4gPSAwO1xuICAgIHRoaXMuc291cmNlID0gbnVsbDtcbiAgICB0aGlzLm9yaWdpbmFsTGluZSA9IG51bGw7XG4gICAgdGhpcy5vcmlnaW5hbENvbHVtbiA9IG51bGw7XG4gICAgdGhpcy5uYW1lID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSB0aGUgbWFwcGluZ3MgaW4gYSBzdHJpbmcgaW4gdG8gYSBkYXRhIHN0cnVjdHVyZSB3aGljaCB3ZSBjYW4gZWFzaWx5XG4gICAqIHF1ZXJ5ICh0aGUgb3JkZXJlZCBhcnJheXMgaW4gdGhlIGB0aGlzLl9fZ2VuZXJhdGVkTWFwcGluZ3NgIGFuZFxuICAgKiBgdGhpcy5fX29yaWdpbmFsTWFwcGluZ3NgIHByb3BlcnRpZXMpLlxuICAgKi9cbiAgQmFzaWNTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuX3BhcnNlTWFwcGluZ3MgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX3BhcnNlTWFwcGluZ3MoYVN0ciwgYVNvdXJjZVJvb3QpIHtcbiAgICAgIHZhciBnZW5lcmF0ZWRMaW5lID0gMTtcbiAgICAgIHZhciBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNPcmlnaW5hbExpbmUgPSAwO1xuICAgICAgdmFyIHByZXZpb3VzT3JpZ2luYWxDb2x1bW4gPSAwO1xuICAgICAgdmFyIHByZXZpb3VzU291cmNlID0gMDtcbiAgICAgIHZhciBwcmV2aW91c05hbWUgPSAwO1xuICAgICAgdmFyIGxlbmd0aCA9IGFTdHIubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4ID0gMDtcbiAgICAgIHZhciBjYWNoZWRTZWdtZW50cyA9IHt9O1xuICAgICAgdmFyIHRlbXAgPSB7fTtcbiAgICAgIHZhciBvcmlnaW5hbE1hcHBpbmdzID0gW107XG4gICAgICB2YXIgZ2VuZXJhdGVkTWFwcGluZ3MgPSBbXTtcbiAgICAgIHZhciBtYXBwaW5nLCBzdHIsIHNlZ21lbnQsIGVuZCwgdmFsdWU7XG5cbiAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICBpZiAoYVN0ci5jaGFyQXQoaW5kZXgpID09PSAnOycpIHtcbiAgICAgICAgICBnZW5lcmF0ZWRMaW5lKys7XG4gICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoYVN0ci5jaGFyQXQoaW5kZXgpID09PSAnLCcpIHtcbiAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG1hcHBpbmcgPSBuZXcgTWFwcGluZygpO1xuICAgICAgICAgIG1hcHBpbmcuZ2VuZXJhdGVkTGluZSA9IGdlbmVyYXRlZExpbmU7XG5cbiAgICAgICAgICAvLyBCZWNhdXNlIGVhY2ggb2Zmc2V0IGlzIGVuY29kZWQgcmVsYXRpdmUgdG8gdGhlIHByZXZpb3VzIG9uZSxcbiAgICAgICAgICAvLyBtYW55IHNlZ21lbnRzIG9mdGVuIGhhdmUgdGhlIHNhbWUgZW5jb2RpbmcuIFdlIGNhbiBleHBsb2l0IHRoaXNcbiAgICAgICAgICAvLyBmYWN0IGJ5IGNhY2hpbmcgdGhlIHBhcnNlZCB2YXJpYWJsZSBsZW5ndGggZmllbGRzIG9mIGVhY2ggc2VnbWVudCxcbiAgICAgICAgICAvLyBhbGxvd2luZyB1cyB0byBhdm9pZCBhIHNlY29uZCBwYXJzZSBpZiB3ZSBlbmNvdW50ZXIgdGhlIHNhbWVcbiAgICAgICAgICAvLyBzZWdtZW50IGFnYWluLlxuICAgICAgICAgIGZvciAoZW5kID0gaW5kZXg7IGVuZCA8IGxlbmd0aDsgZW5kKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jaGFySXNNYXBwaW5nU2VwYXJhdG9yKGFTdHIsIGVuZCkpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0ciA9IGFTdHIuc2xpY2UoaW5kZXgsIGVuZCk7XG5cbiAgICAgICAgICBzZWdtZW50ID0gY2FjaGVkU2VnbWVudHNbc3RyXTtcbiAgICAgICAgICBpZiAoc2VnbWVudCkge1xuICAgICAgICAgICAgaW5kZXggKz0gc3RyLmxlbmd0aDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VnbWVudCA9IFtdO1xuICAgICAgICAgICAgd2hpbGUgKGluZGV4IDwgZW5kKSB7XG4gICAgICAgICAgICAgIGJhc2U2NFZMUS5kZWNvZGUoYVN0ciwgaW5kZXgsIHRlbXApO1xuICAgICAgICAgICAgICB2YWx1ZSA9IHRlbXAudmFsdWU7XG4gICAgICAgICAgICAgIGluZGV4ID0gdGVtcC5yZXN0O1xuICAgICAgICAgICAgICBzZWdtZW50LnB1c2godmFsdWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2VnbWVudC5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCBhIHNvdXJjZSwgYnV0IG5vIGxpbmUgYW5kIGNvbHVtbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2VnbWVudC5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCBhIHNvdXJjZSBhbmQgbGluZSwgYnV0IG5vIGNvbHVtbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYWNoZWRTZWdtZW50c1tzdHJdID0gc2VnbWVudDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBHZW5lcmF0ZWQgY29sdW1uLlxuICAgICAgICAgIG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uID0gcHJldmlvdXNHZW5lcmF0ZWRDb2x1bW4gKyBzZWdtZW50WzBdO1xuICAgICAgICAgIHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uID0gbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW47XG5cbiAgICAgICAgICBpZiAoc2VnbWVudC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAvLyBPcmlnaW5hbCBzb3VyY2UuXG4gICAgICAgICAgICBtYXBwaW5nLnNvdXJjZSA9IHByZXZpb3VzU291cmNlICsgc2VnbWVudFsxXTtcbiAgICAgICAgICAgIHByZXZpb3VzU291cmNlICs9IHNlZ21lbnRbMV07XG5cbiAgICAgICAgICAgIC8vIE9yaWdpbmFsIGxpbmUuXG4gICAgICAgICAgICBtYXBwaW5nLm9yaWdpbmFsTGluZSA9IHByZXZpb3VzT3JpZ2luYWxMaW5lICsgc2VnbWVudFsyXTtcbiAgICAgICAgICAgIHByZXZpb3VzT3JpZ2luYWxMaW5lID0gbWFwcGluZy5vcmlnaW5hbExpbmU7XG4gICAgICAgICAgICAvLyBMaW5lcyBhcmUgc3RvcmVkIDAtYmFzZWRcbiAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxMaW5lICs9IDE7XG5cbiAgICAgICAgICAgIC8vIE9yaWdpbmFsIGNvbHVtbi5cbiAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxDb2x1bW4gPSBwcmV2aW91c09yaWdpbmFsQ29sdW1uICsgc2VnbWVudFszXTtcbiAgICAgICAgICAgIHByZXZpb3VzT3JpZ2luYWxDb2x1bW4gPSBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uO1xuXG4gICAgICAgICAgICBpZiAoc2VnbWVudC5sZW5ndGggPiA0KSB7XG4gICAgICAgICAgICAgIC8vIE9yaWdpbmFsIG5hbWUuXG4gICAgICAgICAgICAgIG1hcHBpbmcubmFtZSA9IHByZXZpb3VzTmFtZSArIHNlZ21lbnRbNF07XG4gICAgICAgICAgICAgIHByZXZpb3VzTmFtZSArPSBzZWdtZW50WzRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGdlbmVyYXRlZE1hcHBpbmdzLnB1c2gobWFwcGluZyk7XG4gICAgICAgICAgaWYgKHR5cGVvZiBtYXBwaW5nLm9yaWdpbmFsTGluZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG9yaWdpbmFsTWFwcGluZ3MucHVzaChtYXBwaW5nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcXVpY2tTb3J0KGdlbmVyYXRlZE1hcHBpbmdzLCB1dGlsLmNvbXBhcmVCeUdlbmVyYXRlZFBvc2l0aW9uc0RlZmxhdGVkKTtcbiAgICAgIHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncyA9IGdlbmVyYXRlZE1hcHBpbmdzO1xuXG4gICAgICBxdWlja1NvcnQob3JpZ2luYWxNYXBwaW5ncywgdXRpbC5jb21wYXJlQnlPcmlnaW5hbFBvc2l0aW9ucyk7XG4gICAgICB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncyA9IG9yaWdpbmFsTWFwcGluZ3M7XG4gICAgfTtcblxuICAvKipcbiAgICogRmluZCB0aGUgbWFwcGluZyB0aGF0IGJlc3QgbWF0Y2hlcyB0aGUgaHlwb3RoZXRpY2FsIFwibmVlZGxlXCIgbWFwcGluZyB0aGF0XG4gICAqIHdlIGFyZSBzZWFyY2hpbmcgZm9yIGluIHRoZSBnaXZlbiBcImhheXN0YWNrXCIgb2YgbWFwcGluZ3MuXG4gICAqL1xuICBCYXNpY1NvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fZmluZE1hcHBpbmcgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2ZpbmRNYXBwaW5nKGFOZWVkbGUsIGFNYXBwaW5ncywgYUxpbmVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFDb2x1bW5OYW1lLCBhQ29tcGFyYXRvciwgYUJpYXMpIHtcbiAgICAgIC8vIFRvIHJldHVybiB0aGUgcG9zaXRpb24gd2UgYXJlIHNlYXJjaGluZyBmb3IsIHdlIG11c3QgZmlyc3QgZmluZCB0aGVcbiAgICAgIC8vIG1hcHBpbmcgZm9yIHRoZSBnaXZlbiBwb3NpdGlvbiBhbmQgdGhlbiByZXR1cm4gdGhlIG9wcG9zaXRlIHBvc2l0aW9uIGl0XG4gICAgICAvLyBwb2ludHMgdG8uIEJlY2F1c2UgdGhlIG1hcHBpbmdzIGFyZSBzb3J0ZWQsIHdlIGNhbiB1c2UgYmluYXJ5IHNlYXJjaCB0b1xuICAgICAgLy8gZmluZCB0aGUgYmVzdCBtYXBwaW5nLlxuXG4gICAgICBpZiAoYU5lZWRsZVthTGluZU5hbWVdIDw9IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignTGluZSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byAxLCBnb3QgJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgYU5lZWRsZVthTGluZU5hbWVdKTtcbiAgICAgIH1cbiAgICAgIGlmIChhTmVlZGxlW2FDb2x1bW5OYW1lXSA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQ29sdW1uIG11c3QgYmUgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIDAsIGdvdCAnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKyBhTmVlZGxlW2FDb2x1bW5OYW1lXSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBiaW5hcnlTZWFyY2guc2VhcmNoKGFOZWVkbGUsIGFNYXBwaW5ncywgYUNvbXBhcmF0b3IsIGFCaWFzKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBDb21wdXRlIHRoZSBsYXN0IGNvbHVtbiBmb3IgZWFjaCBnZW5lcmF0ZWQgbWFwcGluZy4gVGhlIGxhc3QgY29sdW1uIGlzXG4gICAqIGluY2x1c2l2ZS5cbiAgICovXG4gIEJhc2ljU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLmNvbXB1dGVDb2x1bW5TcGFucyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfY29tcHV0ZUNvbHVtblNwYW5zKCkge1xuICAgICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2dlbmVyYXRlZE1hcHBpbmdzLmxlbmd0aDsgKytpbmRleCkge1xuICAgICAgICB2YXIgbWFwcGluZyA9IHRoaXMuX2dlbmVyYXRlZE1hcHBpbmdzW2luZGV4XTtcblxuICAgICAgICAvLyBNYXBwaW5ncyBkbyBub3QgY29udGFpbiBhIGZpZWxkIGZvciB0aGUgbGFzdCBnZW5lcmF0ZWQgY29sdW1udC4gV2VcbiAgICAgICAgLy8gY2FuIGNvbWUgdXAgd2l0aCBhbiBvcHRpbWlzdGljIGVzdGltYXRlLCBob3dldmVyLCBieSBhc3N1bWluZyB0aGF0XG4gICAgICAgIC8vIG1hcHBpbmdzIGFyZSBjb250aWd1b3VzIChpLmUuIGdpdmVuIHR3byBjb25zZWN1dGl2ZSBtYXBwaW5ncywgdGhlXG4gICAgICAgIC8vIGZpcnN0IG1hcHBpbmcgZW5kcyB3aGVyZSB0aGUgc2Vjb25kIG9uZSBzdGFydHMpLlxuICAgICAgICBpZiAoaW5kZXggKyAxIDwgdGhpcy5fZ2VuZXJhdGVkTWFwcGluZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIG5leHRNYXBwaW5nID0gdGhpcy5fZ2VuZXJhdGVkTWFwcGluZ3NbaW5kZXggKyAxXTtcblxuICAgICAgICAgIGlmIChtYXBwaW5nLmdlbmVyYXRlZExpbmUgPT09IG5leHRNYXBwaW5nLmdlbmVyYXRlZExpbmUpIHtcbiAgICAgICAgICAgIG1hcHBpbmcubGFzdEdlbmVyYXRlZENvbHVtbiA9IG5leHRNYXBwaW5nLmdlbmVyYXRlZENvbHVtbiAtIDE7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgbGFzdCBtYXBwaW5nIGZvciBlYWNoIGxpbmUgc3BhbnMgdGhlIGVudGlyZSBsaW5lLlxuICAgICAgICBtYXBwaW5nLmxhc3RHZW5lcmF0ZWRDb2x1bW4gPSBJbmZpbml0eTtcbiAgICAgIH1cbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBvcmlnaW5hbCBzb3VyY2UsIGxpbmUsIGFuZCBjb2x1bW4gaW5mb3JtYXRpb24gZm9yIHRoZSBnZW5lcmF0ZWRcbiAgICogc291cmNlJ3MgbGluZSBhbmQgY29sdW1uIHBvc2l0aW9ucyBwcm92aWRlZC4gVGhlIG9ubHkgYXJndW1lbnQgaXMgYW4gb2JqZWN0XG4gICAqIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gbGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLlxuICAgKiAgIC0gY29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZS5cbiAgICogICAtIGJpYXM6IEVpdGhlciAnU291cmNlTWFwQ29uc3VtZXIuR1JFQVRFU1RfTE9XRVJfQk9VTkQnIG9yXG4gICAqICAgICAnU291cmNlTWFwQ29uc3VtZXIuTEVBU1RfVVBQRVJfQk9VTkQnLiBTcGVjaWZpZXMgd2hldGhlciB0byByZXR1cm4gdGhlXG4gICAqICAgICBjbG9zZXN0IGVsZW1lbnQgdGhhdCBpcyBzbWFsbGVyIHRoYW4gb3IgZ3JlYXRlciB0aGFuIHRoZSBvbmUgd2UgYXJlXG4gICAqICAgICBzZWFyY2hpbmcgZm9yLCByZXNwZWN0aXZlbHksIGlmIHRoZSBleGFjdCBlbGVtZW50IGNhbm5vdCBiZSBmb3VuZC5cbiAgICogICAgIERlZmF1bHRzIHRvICdTb3VyY2VNYXBDb25zdW1lci5HUkVBVEVTVF9MT1dFUl9CT1VORCcuXG4gICAqXG4gICAqIGFuZCBhbiBvYmplY3QgaXMgcmV0dXJuZWQgd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBzb3VyY2U6IFRoZSBvcmlnaW5hbCBzb3VyY2UgZmlsZSwgb3IgbnVsbC5cbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLCBvciBudWxsLlxuICAgKiAgIC0gY29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLCBvciBudWxsLlxuICAgKiAgIC0gbmFtZTogVGhlIG9yaWdpbmFsIGlkZW50aWZpZXIsIG9yIG51bGwuXG4gICAqL1xuICBCYXNpY1NvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5vcmlnaW5hbFBvc2l0aW9uRm9yID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9vcmlnaW5hbFBvc2l0aW9uRm9yKGFBcmdzKSB7XG4gICAgICB2YXIgbmVlZGxlID0ge1xuICAgICAgICBnZW5lcmF0ZWRMaW5lOiB1dGlsLmdldEFyZyhhQXJncywgJ2xpbmUnKSxcbiAgICAgICAgZ2VuZXJhdGVkQ29sdW1uOiB1dGlsLmdldEFyZyhhQXJncywgJ2NvbHVtbicpXG4gICAgICB9O1xuXG4gICAgICB2YXIgaW5kZXggPSB0aGlzLl9maW5kTWFwcGluZyhcbiAgICAgICAgbmVlZGxlLFxuICAgICAgICB0aGlzLl9nZW5lcmF0ZWRNYXBwaW5ncyxcbiAgICAgICAgXCJnZW5lcmF0ZWRMaW5lXCIsXG4gICAgICAgIFwiZ2VuZXJhdGVkQ29sdW1uXCIsXG4gICAgICAgIHV0aWwuY29tcGFyZUJ5R2VuZXJhdGVkUG9zaXRpb25zRGVmbGF0ZWQsXG4gICAgICAgIHV0aWwuZ2V0QXJnKGFBcmdzLCAnYmlhcycsIFNvdXJjZU1hcENvbnN1bWVyLkdSRUFURVNUX0xPV0VSX0JPVU5EKVxuICAgICAgKTtcblxuICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgdmFyIG1hcHBpbmcgPSB0aGlzLl9nZW5lcmF0ZWRNYXBwaW5nc1tpbmRleF07XG5cbiAgICAgICAgaWYgKG1hcHBpbmcuZ2VuZXJhdGVkTGluZSA9PT0gbmVlZGxlLmdlbmVyYXRlZExpbmUpIHtcbiAgICAgICAgICB2YXIgc291cmNlID0gdXRpbC5nZXRBcmcobWFwcGluZywgJ3NvdXJjZScsIG51bGwpO1xuICAgICAgICAgIGlmIChzb3VyY2UgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHNvdXJjZSA9IHRoaXMuX3NvdXJjZXMuYXQoc291cmNlKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBzb3VyY2UgPSB1dGlsLmpvaW4odGhpcy5zb3VyY2VSb290LCBzb3VyY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgbmFtZSA9IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICduYW1lJywgbnVsbCk7XG4gICAgICAgICAgaWYgKG5hbWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIG5hbWUgPSB0aGlzLl9uYW1lcy5hdChuYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNvdXJjZTogc291cmNlLFxuICAgICAgICAgICAgbGluZTogdXRpbC5nZXRBcmcobWFwcGluZywgJ29yaWdpbmFsTGluZScsIG51bGwpLFxuICAgICAgICAgICAgY29sdW1uOiB1dGlsLmdldEFyZyhtYXBwaW5nLCAnb3JpZ2luYWxDb2x1bW4nLCBudWxsKSxcbiAgICAgICAgICAgIG5hbWU6IG5hbWVcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNvdXJjZTogbnVsbCxcbiAgICAgICAgbGluZTogbnVsbCxcbiAgICAgICAgY29sdW1uOiBudWxsLFxuICAgICAgICBuYW1lOiBudWxsXG4gICAgICB9O1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHdlIGhhdmUgdGhlIHNvdXJjZSBjb250ZW50IGZvciBldmVyeSBzb3VyY2UgaW4gdGhlIHNvdXJjZVxuICAgKiBtYXAsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIEJhc2ljU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLmhhc0NvbnRlbnRzT2ZBbGxTb3VyY2VzID1cbiAgICBmdW5jdGlvbiBCYXNpY1NvdXJjZU1hcENvbnN1bWVyX2hhc0NvbnRlbnRzT2ZBbGxTb3VyY2VzKCkge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZXNDb250ZW50KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnNvdXJjZXNDb250ZW50Lmxlbmd0aCA+PSB0aGlzLl9zb3VyY2VzLnNpemUoKSAmJlxuICAgICAgICAhdGhpcy5zb3VyY2VzQ29udGVudC5zb21lKGZ1bmN0aW9uIChzYykgeyByZXR1cm4gc2MgPT0gbnVsbDsgfSk7XG4gICAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgb3JpZ2luYWwgc291cmNlIGNvbnRlbnQuIFRoZSBvbmx5IGFyZ3VtZW50IGlzIHRoZSB1cmwgb2YgdGhlXG4gICAqIG9yaWdpbmFsIHNvdXJjZSBmaWxlLiBSZXR1cm5zIG51bGwgaWYgbm8gb3JpZ2luYWwgc291cmNlIGNvbnRlbnQgaXNcbiAgICogYXZhaWxpYmxlLlxuICAgKi9cbiAgQmFzaWNTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuc291cmNlQ29udGVudEZvciA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfc291cmNlQ29udGVudEZvcihhU291cmNlLCBudWxsT25NaXNzaW5nKSB7XG4gICAgICBpZiAoIXRoaXMuc291cmNlc0NvbnRlbnQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBhU291cmNlID0gdXRpbC5yZWxhdGl2ZSh0aGlzLnNvdXJjZVJvb3QsIGFTb3VyY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fc291cmNlcy5oYXMoYVNvdXJjZSkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlc0NvbnRlbnRbdGhpcy5fc291cmNlcy5pbmRleE9mKGFTb3VyY2UpXTtcbiAgICAgIH1cblxuICAgICAgdmFyIHVybDtcbiAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbFxuICAgICAgICAgICYmICh1cmwgPSB1dGlsLnVybFBhcnNlKHRoaXMuc291cmNlUm9vdCkpKSB7XG4gICAgICAgIC8vIFhYWDogZmlsZTovLyBVUklzIGFuZCBhYnNvbHV0ZSBwYXRocyBsZWFkIHRvIHVuZXhwZWN0ZWQgYmVoYXZpb3IgZm9yXG4gICAgICAgIC8vIG1hbnkgdXNlcnMuIFdlIGNhbiBoZWxwIHRoZW0gb3V0IHdoZW4gdGhleSBleHBlY3QgZmlsZTovLyBVUklzIHRvXG4gICAgICAgIC8vIGJlaGF2ZSBsaWtlIGl0IHdvdWxkIGlmIHRoZXkgd2VyZSBydW5uaW5nIGEgbG9jYWwgSFRUUCBzZXJ2ZXIuIFNlZVxuICAgICAgICAvLyBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD04ODU1OTcuXG4gICAgICAgIHZhciBmaWxlVXJpQWJzUGF0aCA9IGFTb3VyY2UucmVwbGFjZSgvXmZpbGU6XFwvXFwvLywgXCJcIik7XG4gICAgICAgIGlmICh1cmwuc2NoZW1lID09IFwiZmlsZVwiXG4gICAgICAgICAgICAmJiB0aGlzLl9zb3VyY2VzLmhhcyhmaWxlVXJpQWJzUGF0aCkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2VzQ29udGVudFt0aGlzLl9zb3VyY2VzLmluZGV4T2YoZmlsZVVyaUFic1BhdGgpXVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCghdXJsLnBhdGggfHwgdXJsLnBhdGggPT0gXCIvXCIpXG4gICAgICAgICAgICAmJiB0aGlzLl9zb3VyY2VzLmhhcyhcIi9cIiArIGFTb3VyY2UpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlc0NvbnRlbnRbdGhpcy5fc291cmNlcy5pbmRleE9mKFwiL1wiICsgYVNvdXJjZSldO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCByZWN1cnNpdmVseSBmcm9tXG4gICAgICAvLyBJbmRleGVkU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLnNvdXJjZUNvbnRlbnRGb3IuIEluIHRoYXQgY2FzZSwgd2VcbiAgICAgIC8vIGRvbid0IHdhbnQgdG8gdGhyb3cgaWYgd2UgY2FuJ3QgZmluZCB0aGUgc291cmNlIC0gd2UganVzdCB3YW50IHRvXG4gICAgICAvLyByZXR1cm4gbnVsbCwgc28gd2UgcHJvdmlkZSBhIGZsYWcgdG8gZXhpdCBncmFjZWZ1bGx5LlxuICAgICAgaWYgKG51bGxPbk1pc3NpbmcpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdcIicgKyBhU291cmNlICsgJ1wiIGlzIG5vdCBpbiB0aGUgU291cmNlTWFwLicpO1xuICAgICAgfVxuICAgIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGdlbmVyYXRlZCBsaW5lIGFuZCBjb2x1bW4gaW5mb3JtYXRpb24gZm9yIHRoZSBvcmlnaW5hbCBzb3VyY2UsXG4gICAqIGxpbmUsIGFuZCBjb2x1bW4gcG9zaXRpb25zIHByb3ZpZGVkLiBUaGUgb25seSBhcmd1bWVudCBpcyBhbiBvYmplY3Qgd2l0aFxuICAgKiB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBzb3VyY2U6IFRoZSBmaWxlbmFtZSBvZiB0aGUgb3JpZ2luYWwgc291cmNlLlxuICAgKiAgIC0gbGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBvcmlnaW5hbCBzb3VyY2UuXG4gICAqICAgLSBjb2x1bW46IFRoZSBjb2x1bW4gbnVtYmVyIGluIHRoZSBvcmlnaW5hbCBzb3VyY2UuXG4gICAqICAgLSBiaWFzOiBFaXRoZXIgJ1NvdXJjZU1hcENvbnN1bWVyLkdSRUFURVNUX0xPV0VSX0JPVU5EJyBvclxuICAgKiAgICAgJ1NvdXJjZU1hcENvbnN1bWVyLkxFQVNUX1VQUEVSX0JPVU5EJy4gU3BlY2lmaWVzIHdoZXRoZXIgdG8gcmV0dXJuIHRoZVxuICAgKiAgICAgY2xvc2VzdCBlbGVtZW50IHRoYXQgaXMgc21hbGxlciB0aGFuIG9yIGdyZWF0ZXIgdGhhbiB0aGUgb25lIHdlIGFyZVxuICAgKiAgICAgc2VhcmNoaW5nIGZvciwgcmVzcGVjdGl2ZWx5LCBpZiB0aGUgZXhhY3QgZWxlbWVudCBjYW5ub3QgYmUgZm91bmQuXG4gICAqICAgICBEZWZhdWx0cyB0byAnU291cmNlTWFwQ29uc3VtZXIuR1JFQVRFU1RfTE9XRVJfQk9VTkQnLlxuICAgKlxuICAgKiBhbmQgYW4gb2JqZWN0IGlzIHJldHVybmVkIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gbGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLCBvciBudWxsLlxuICAgKiAgIC0gY29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZSwgb3IgbnVsbC5cbiAgICovXG4gIEJhc2ljU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLmdlbmVyYXRlZFBvc2l0aW9uRm9yID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9nZW5lcmF0ZWRQb3NpdGlvbkZvcihhQXJncykge1xuICAgICAgdmFyIHNvdXJjZSA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnc291cmNlJyk7XG4gICAgICBpZiAodGhpcy5zb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgc291cmNlID0gdXRpbC5yZWxhdGl2ZSh0aGlzLnNvdXJjZVJvb3QsIHNvdXJjZSk7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuX3NvdXJjZXMuaGFzKHNvdXJjZSkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBsaW5lOiBudWxsLFxuICAgICAgICAgIGNvbHVtbjogbnVsbCxcbiAgICAgICAgICBsYXN0Q29sdW1uOiBudWxsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBzb3VyY2UgPSB0aGlzLl9zb3VyY2VzLmluZGV4T2Yoc291cmNlKTtcblxuICAgICAgdmFyIG5lZWRsZSA9IHtcbiAgICAgICAgc291cmNlOiBzb3VyY2UsXG4gICAgICAgIG9yaWdpbmFsTGluZTogdXRpbC5nZXRBcmcoYUFyZ3MsICdsaW5lJyksXG4gICAgICAgIG9yaWdpbmFsQ29sdW1uOiB1dGlsLmdldEFyZyhhQXJncywgJ2NvbHVtbicpXG4gICAgICB9O1xuXG4gICAgICB2YXIgaW5kZXggPSB0aGlzLl9maW5kTWFwcGluZyhcbiAgICAgICAgbmVlZGxlLFxuICAgICAgICB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzLFxuICAgICAgICBcIm9yaWdpbmFsTGluZVwiLFxuICAgICAgICBcIm9yaWdpbmFsQ29sdW1uXCIsXG4gICAgICAgIHV0aWwuY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMsXG4gICAgICAgIHV0aWwuZ2V0QXJnKGFBcmdzLCAnYmlhcycsIFNvdXJjZU1hcENvbnN1bWVyLkdSRUFURVNUX0xPV0VSX0JPVU5EKVxuICAgICAgKTtcblxuICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgdmFyIG1hcHBpbmcgPSB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzW2luZGV4XTtcblxuICAgICAgICBpZiAobWFwcGluZy5zb3VyY2UgPT09IG5lZWRsZS5zb3VyY2UpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbGluZTogdXRpbC5nZXRBcmcobWFwcGluZywgJ2dlbmVyYXRlZExpbmUnLCBudWxsKSxcbiAgICAgICAgICAgIGNvbHVtbjogdXRpbC5nZXRBcmcobWFwcGluZywgJ2dlbmVyYXRlZENvbHVtbicsIG51bGwpLFxuICAgICAgICAgICAgbGFzdENvbHVtbjogdXRpbC5nZXRBcmcobWFwcGluZywgJ2xhc3RHZW5lcmF0ZWRDb2x1bW4nLCBudWxsKVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbGluZTogbnVsbCxcbiAgICAgICAgY29sdW1uOiBudWxsLFxuICAgICAgICBsYXN0Q29sdW1uOiBudWxsXG4gICAgICB9O1xuICAgIH07XG5cbiAgZXhwb3J0cy5CYXNpY1NvdXJjZU1hcENvbnN1bWVyID0gQmFzaWNTb3VyY2VNYXBDb25zdW1lcjtcblxuICAvKipcbiAgICogQW4gSW5kZXhlZFNvdXJjZU1hcENvbnN1bWVyIGluc3RhbmNlIHJlcHJlc2VudHMgYSBwYXJzZWQgc291cmNlIG1hcCB3aGljaFxuICAgKiB3ZSBjYW4gcXVlcnkgZm9yIGluZm9ybWF0aW9uLiBJdCBkaWZmZXJzIGZyb20gQmFzaWNTb3VyY2VNYXBDb25zdW1lciBpblxuICAgKiB0aGF0IGl0IHRha2VzIFwiaW5kZXhlZFwiIHNvdXJjZSBtYXBzIChpLmUuIG9uZXMgd2l0aCBhIFwic2VjdGlvbnNcIiBmaWVsZCkgYXNcbiAgICogaW5wdXQuXG4gICAqXG4gICAqIFRoZSBvbmx5IHBhcmFtZXRlciBpcyBhIHJhdyBzb3VyY2UgbWFwIChlaXRoZXIgYXMgYSBKU09OIHN0cmluZywgb3IgYWxyZWFkeVxuICAgKiBwYXJzZWQgdG8gYW4gb2JqZWN0KS4gQWNjb3JkaW5nIHRvIHRoZSBzcGVjIGZvciBpbmRleGVkIHNvdXJjZSBtYXBzLCB0aGV5XG4gICAqIGhhdmUgdGhlIGZvbGxvd2luZyBhdHRyaWJ1dGVzOlxuICAgKlxuICAgKiAgIC0gdmVyc2lvbjogV2hpY2ggdmVyc2lvbiBvZiB0aGUgc291cmNlIG1hcCBzcGVjIHRoaXMgbWFwIGlzIGZvbGxvd2luZy5cbiAgICogICAtIGZpbGU6IE9wdGlvbmFsLiBUaGUgZ2VuZXJhdGVkIGZpbGUgdGhpcyBzb3VyY2UgbWFwIGlzIGFzc29jaWF0ZWQgd2l0aC5cbiAgICogICAtIHNlY3Rpb25zOiBBIGxpc3Qgb2Ygc2VjdGlvbiBkZWZpbml0aW9ucy5cbiAgICpcbiAgICogRWFjaCB2YWx1ZSB1bmRlciB0aGUgXCJzZWN0aW9uc1wiIGZpZWxkIGhhcyB0d28gZmllbGRzOlxuICAgKiAgIC0gb2Zmc2V0OiBUaGUgb2Zmc2V0IGludG8gdGhlIG9yaWdpbmFsIHNwZWNpZmllZCBhdCB3aGljaCB0aGlzIHNlY3Rpb25cbiAgICogICAgICAgYmVnaW5zIHRvIGFwcGx5LCBkZWZpbmVkIGFzIGFuIG9iamVjdCB3aXRoIGEgXCJsaW5lXCIgYW5kIFwiY29sdW1uXCJcbiAgICogICAgICAgZmllbGQuXG4gICAqICAgLSBtYXA6IEEgc291cmNlIG1hcCBkZWZpbml0aW9uLiBUaGlzIHNvdXJjZSBtYXAgY291bGQgYWxzbyBiZSBpbmRleGVkLFxuICAgKiAgICAgICBidXQgZG9lc24ndCBoYXZlIHRvIGJlLlxuICAgKlxuICAgKiBJbnN0ZWFkIG9mIHRoZSBcIm1hcFwiIGZpZWxkLCBpdCdzIGFsc28gcG9zc2libGUgdG8gaGF2ZSBhIFwidXJsXCIgZmllbGRcbiAgICogc3BlY2lmeWluZyBhIFVSTCB0byByZXRyaWV2ZSBhIHNvdXJjZSBtYXAgZnJvbSwgYnV0IHRoYXQncyBjdXJyZW50bHlcbiAgICogdW5zdXBwb3J0ZWQuXG4gICAqXG4gICAqIEhlcmUncyBhbiBleGFtcGxlIHNvdXJjZSBtYXAsIHRha2VuIGZyb20gdGhlIHNvdXJjZSBtYXAgc3BlY1swXSwgYnV0XG4gICAqIG1vZGlmaWVkIHRvIG9taXQgYSBzZWN0aW9uIHdoaWNoIHVzZXMgdGhlIFwidXJsXCIgZmllbGQuXG4gICAqXG4gICAqICB7XG4gICAqICAgIHZlcnNpb24gOiAzLFxuICAgKiAgICBmaWxlOiBcImFwcC5qc1wiLFxuICAgKiAgICBzZWN0aW9uczogW3tcbiAgICogICAgICBvZmZzZXQ6IHtsaW5lOjEwMCwgY29sdW1uOjEwfSxcbiAgICogICAgICBtYXA6IHtcbiAgICogICAgICAgIHZlcnNpb24gOiAzLFxuICAgKiAgICAgICAgZmlsZTogXCJzZWN0aW9uLmpzXCIsXG4gICAqICAgICAgICBzb3VyY2VzOiBbXCJmb28uanNcIiwgXCJiYXIuanNcIl0sXG4gICAqICAgICAgICBuYW1lczogW1wic3JjXCIsIFwibWFwc1wiLCBcImFyZVwiLCBcImZ1blwiXSxcbiAgICogICAgICAgIG1hcHBpbmdzOiBcIkFBQUEsRTs7QUJDREU7XCJcbiAgICogICAgICB9XG4gICAqICAgIH1dLFxuICAgKiAgfVxuICAgKlxuICAgKiBbMF06IGh0dHBzOi8vZG9jcy5nb29nbGUuY29tL2RvY3VtZW50L2QvMVUxUkdBZWhRd1J5cFVUb3ZGMUtSbHBpT0Z6ZTBiLV8yZ2M2ZkFIMEtZMGsvZWRpdCNoZWFkaW5nPWguNTM1ZXMzeGVwcmd0XG4gICAqL1xuICBmdW5jdGlvbiBJbmRleGVkU291cmNlTWFwQ29uc3VtZXIoYVNvdXJjZU1hcCkge1xuICAgIHZhciBzb3VyY2VNYXAgPSBhU291cmNlTWFwO1xuICAgIGlmICh0eXBlb2YgYVNvdXJjZU1hcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHNvdXJjZU1hcCA9IEpTT04ucGFyc2UoYVNvdXJjZU1hcC5yZXBsYWNlKC9eXFwpXFxdXFx9Jy8sICcnKSk7XG4gICAgfVxuXG4gICAgdmFyIHZlcnNpb24gPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICd2ZXJzaW9uJyk7XG4gICAgdmFyIHNlY3Rpb25zID0gdXRpbC5nZXRBcmcoc291cmNlTWFwLCAnc2VjdGlvbnMnKTtcblxuICAgIGlmICh2ZXJzaW9uICE9IHRoaXMuX3ZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgdmVyc2lvbjogJyArIHZlcnNpb24pO1xuICAgIH1cblxuICAgIHRoaXMuX3NvdXJjZXMgPSBuZXcgQXJyYXlTZXQoKTtcbiAgICB0aGlzLl9uYW1lcyA9IG5ldyBBcnJheVNldCgpO1xuXG4gICAgdmFyIGxhc3RPZmZzZXQgPSB7XG4gICAgICBsaW5lOiAtMSxcbiAgICAgIGNvbHVtbjogMFxuICAgIH07XG4gICAgdGhpcy5fc2VjdGlvbnMgPSBzZWN0aW9ucy5tYXAoZnVuY3Rpb24gKHMpIHtcbiAgICAgIGlmIChzLnVybCkge1xuICAgICAgICAvLyBUaGUgdXJsIGZpZWxkIHdpbGwgcmVxdWlyZSBzdXBwb3J0IGZvciBhc3luY2hyb25pY2l0eS5cbiAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL3NvdXJjZS1tYXAvaXNzdWVzLzE2XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3VwcG9ydCBmb3IgdXJsIGZpZWxkIGluIHNlY3Rpb25zIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgICAgIH1cbiAgICAgIHZhciBvZmZzZXQgPSB1dGlsLmdldEFyZyhzLCAnb2Zmc2V0Jyk7XG4gICAgICB2YXIgb2Zmc2V0TGluZSA9IHV0aWwuZ2V0QXJnKG9mZnNldCwgJ2xpbmUnKTtcbiAgICAgIHZhciBvZmZzZXRDb2x1bW4gPSB1dGlsLmdldEFyZyhvZmZzZXQsICdjb2x1bW4nKTtcblxuICAgICAgaWYgKG9mZnNldExpbmUgPCBsYXN0T2Zmc2V0LmxpbmUgfHxcbiAgICAgICAgICAob2Zmc2V0TGluZSA9PT0gbGFzdE9mZnNldC5saW5lICYmIG9mZnNldENvbHVtbiA8IGxhc3RPZmZzZXQuY29sdW1uKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlY3Rpb24gb2Zmc2V0cyBtdXN0IGJlIG9yZGVyZWQgYW5kIG5vbi1vdmVybGFwcGluZy4nKTtcbiAgICAgIH1cbiAgICAgIGxhc3RPZmZzZXQgPSBvZmZzZXQ7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGdlbmVyYXRlZE9mZnNldDoge1xuICAgICAgICAgIC8vIFRoZSBvZmZzZXQgZmllbGRzIGFyZSAwLWJhc2VkLCBidXQgd2UgdXNlIDEtYmFzZWQgaW5kaWNlcyB3aGVuXG4gICAgICAgICAgLy8gZW5jb2RpbmcvZGVjb2RpbmcgZnJvbSBWTFEuXG4gICAgICAgICAgZ2VuZXJhdGVkTGluZTogb2Zmc2V0TGluZSArIDEsXG4gICAgICAgICAgZ2VuZXJhdGVkQ29sdW1uOiBvZmZzZXRDb2x1bW4gKyAxXG4gICAgICAgIH0sXG4gICAgICAgIGNvbnN1bWVyOiBuZXcgU291cmNlTWFwQ29uc3VtZXIodXRpbC5nZXRBcmcocywgJ21hcCcpKVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgSW5kZXhlZFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlKTtcbiAgSW5kZXhlZFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFNvdXJjZU1hcENvbnN1bWVyO1xuXG4gIC8qKlxuICAgKiBUaGUgdmVyc2lvbiBvZiB0aGUgc291cmNlIG1hcHBpbmcgc3BlYyB0aGF0IHdlIGFyZSBjb25zdW1pbmcuXG4gICAqL1xuICBJbmRleGVkU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl92ZXJzaW9uID0gMztcblxuICAvKipcbiAgICogVGhlIGxpc3Qgb2Ygb3JpZ2luYWwgc291cmNlcy5cbiAgICovXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbmRleGVkU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLCAnc291cmNlcycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBzb3VyY2VzID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX3NlY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdGhpcy5fc2VjdGlvbnNbaV0uY29uc3VtZXIuc291cmNlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHNvdXJjZXMucHVzaCh0aGlzLl9zZWN0aW9uc1tpXS5jb25zdW1lci5zb3VyY2VzW2pdKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHJldHVybiBzb3VyY2VzO1xuICAgIH1cbiAgfSk7XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG9yaWdpbmFsIHNvdXJjZSwgbGluZSwgYW5kIGNvbHVtbiBpbmZvcm1hdGlvbiBmb3IgdGhlIGdlbmVyYXRlZFxuICAgKiBzb3VyY2UncyBsaW5lIGFuZCBjb2x1bW4gcG9zaXRpb25zIHByb3ZpZGVkLiBUaGUgb25seSBhcmd1bWVudCBpcyBhbiBvYmplY3RcbiAgICogd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBsaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UuXG4gICAqICAgLSBjb2x1bW46IFRoZSBjb2x1bW4gbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLlxuICAgKlxuICAgKiBhbmQgYW4gb2JqZWN0IGlzIHJldHVybmVkIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gc291cmNlOiBUaGUgb3JpZ2luYWwgc291cmNlIGZpbGUsIG9yIG51bGwuXG4gICAqICAgLSBsaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZSwgb3IgbnVsbC5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZSwgb3IgbnVsbC5cbiAgICogICAtIG5hbWU6IFRoZSBvcmlnaW5hbCBpZGVudGlmaWVyLCBvciBudWxsLlxuICAgKi9cbiAgSW5kZXhlZFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5vcmlnaW5hbFBvc2l0aW9uRm9yID1cbiAgICBmdW5jdGlvbiBJbmRleGVkU291cmNlTWFwQ29uc3VtZXJfb3JpZ2luYWxQb3NpdGlvbkZvcihhQXJncykge1xuICAgICAgdmFyIG5lZWRsZSA9IHtcbiAgICAgICAgZ2VuZXJhdGVkTGluZTogdXRpbC5nZXRBcmcoYUFyZ3MsICdsaW5lJyksXG4gICAgICAgIGdlbmVyYXRlZENvbHVtbjogdXRpbC5nZXRBcmcoYUFyZ3MsICdjb2x1bW4nKVxuICAgICAgfTtcblxuICAgICAgLy8gRmluZCB0aGUgc2VjdGlvbiBjb250YWluaW5nIHRoZSBnZW5lcmF0ZWQgcG9zaXRpb24gd2UncmUgdHJ5aW5nIHRvIG1hcFxuICAgICAgLy8gdG8gYW4gb3JpZ2luYWwgcG9zaXRpb24uXG4gICAgICB2YXIgc2VjdGlvbkluZGV4ID0gYmluYXJ5U2VhcmNoLnNlYXJjaChuZWVkbGUsIHRoaXMuX3NlY3Rpb25zLFxuICAgICAgICBmdW5jdGlvbihuZWVkbGUsIHNlY3Rpb24pIHtcbiAgICAgICAgICB2YXIgY21wID0gbmVlZGxlLmdlbmVyYXRlZExpbmUgLSBzZWN0aW9uLmdlbmVyYXRlZE9mZnNldC5nZW5lcmF0ZWRMaW5lO1xuICAgICAgICAgIGlmIChjbXApIHtcbiAgICAgICAgICAgIHJldHVybiBjbXA7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIChuZWVkbGUuZ2VuZXJhdGVkQ29sdW1uIC1cbiAgICAgICAgICAgICAgICAgIHNlY3Rpb24uZ2VuZXJhdGVkT2Zmc2V0LmdlbmVyYXRlZENvbHVtbik7XG4gICAgICAgIH0pO1xuICAgICAgdmFyIHNlY3Rpb24gPSB0aGlzLl9zZWN0aW9uc1tzZWN0aW9uSW5kZXhdO1xuXG4gICAgICBpZiAoIXNlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzb3VyY2U6IG51bGwsXG4gICAgICAgICAgbGluZTogbnVsbCxcbiAgICAgICAgICBjb2x1bW46IG51bGwsXG4gICAgICAgICAgbmFtZTogbnVsbFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2VjdGlvbi5jb25zdW1lci5vcmlnaW5hbFBvc2l0aW9uRm9yKHtcbiAgICAgICAgbGluZTogbmVlZGxlLmdlbmVyYXRlZExpbmUgLVxuICAgICAgICAgIChzZWN0aW9uLmdlbmVyYXRlZE9mZnNldC5nZW5lcmF0ZWRMaW5lIC0gMSksXG4gICAgICAgIGNvbHVtbjogbmVlZGxlLmdlbmVyYXRlZENvbHVtbiAtXG4gICAgICAgICAgKHNlY3Rpb24uZ2VuZXJhdGVkT2Zmc2V0LmdlbmVyYXRlZExpbmUgPT09IG5lZWRsZS5nZW5lcmF0ZWRMaW5lXG4gICAgICAgICAgID8gc2VjdGlvbi5nZW5lcmF0ZWRPZmZzZXQuZ2VuZXJhdGVkQ29sdW1uIC0gMVxuICAgICAgICAgICA6IDApLFxuICAgICAgICBiaWFzOiBhQXJncy5iaWFzXG4gICAgICB9KTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gdHJ1ZSBpZiB3ZSBoYXZlIHRoZSBzb3VyY2UgY29udGVudCBmb3IgZXZlcnkgc291cmNlIGluIHRoZSBzb3VyY2VcbiAgICogbWFwLCBmYWxzZSBvdGhlcndpc2UuXG4gICAqL1xuICBJbmRleGVkU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLmhhc0NvbnRlbnRzT2ZBbGxTb3VyY2VzID1cbiAgICBmdW5jdGlvbiBJbmRleGVkU291cmNlTWFwQ29uc3VtZXJfaGFzQ29udGVudHNPZkFsbFNvdXJjZXMoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc2VjdGlvbnMuZXZlcnkoZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgcmV0dXJuIHMuY29uc3VtZXIuaGFzQ29udGVudHNPZkFsbFNvdXJjZXMoKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG9yaWdpbmFsIHNvdXJjZSBjb250ZW50LiBUaGUgb25seSBhcmd1bWVudCBpcyB0aGUgdXJsIG9mIHRoZVxuICAgKiBvcmlnaW5hbCBzb3VyY2UgZmlsZS4gUmV0dXJucyBudWxsIGlmIG5vIG9yaWdpbmFsIHNvdXJjZSBjb250ZW50IGlzXG4gICAqIGF2YWlsYWJsZS5cbiAgICovXG4gIEluZGV4ZWRTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuc291cmNlQ29udGVudEZvciA9XG4gICAgZnVuY3Rpb24gSW5kZXhlZFNvdXJjZU1hcENvbnN1bWVyX3NvdXJjZUNvbnRlbnRGb3IoYVNvdXJjZSwgbnVsbE9uTWlzc2luZykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9zZWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgc2VjdGlvbiA9IHRoaXMuX3NlY3Rpb25zW2ldO1xuXG4gICAgICAgIHZhciBjb250ZW50ID0gc2VjdGlvbi5jb25zdW1lci5zb3VyY2VDb250ZW50Rm9yKGFTb3VyY2UsIHRydWUpO1xuICAgICAgICBpZiAoY29udGVudCkge1xuICAgICAgICAgIHJldHVybiBjb250ZW50O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAobnVsbE9uTWlzc2luZykge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1wiJyArIGFTb3VyY2UgKyAnXCIgaXMgbm90IGluIHRoZSBTb3VyY2VNYXAuJyk7XG4gICAgICB9XG4gICAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgZ2VuZXJhdGVkIGxpbmUgYW5kIGNvbHVtbiBpbmZvcm1hdGlvbiBmb3IgdGhlIG9yaWdpbmFsIHNvdXJjZSxcbiAgICogbGluZSwgYW5kIGNvbHVtbiBwb3NpdGlvbnMgcHJvdmlkZWQuIFRoZSBvbmx5IGFyZ3VtZW50IGlzIGFuIG9iamVjdCB3aXRoXG4gICAqIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIHNvdXJjZTogVGhlIGZpbGVuYW1lIG9mIHRoZSBvcmlnaW5hbCBzb3VyY2UuXG4gICAqICAgLSBsaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICpcbiAgICogYW5kIGFuIG9iamVjdCBpcyByZXR1cm5lZCB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZSwgb3IgbnVsbC5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UsIG9yIG51bGwuXG4gICAqL1xuICBJbmRleGVkU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLmdlbmVyYXRlZFBvc2l0aW9uRm9yID1cbiAgICBmdW5jdGlvbiBJbmRleGVkU291cmNlTWFwQ29uc3VtZXJfZ2VuZXJhdGVkUG9zaXRpb25Gb3IoYUFyZ3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fc2VjdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHNlY3Rpb24gPSB0aGlzLl9zZWN0aW9uc1tpXTtcblxuICAgICAgICAvLyBPbmx5IGNvbnNpZGVyIHRoaXMgc2VjdGlvbiBpZiB0aGUgcmVxdWVzdGVkIHNvdXJjZSBpcyBpbiB0aGUgbGlzdCBvZlxuICAgICAgICAvLyBzb3VyY2VzIG9mIHRoZSBjb25zdW1lci5cbiAgICAgICAgaWYgKHNlY3Rpb24uY29uc3VtZXIuc291cmNlcy5pbmRleE9mKHV0aWwuZ2V0QXJnKGFBcmdzLCAnc291cmNlJykpID09PSAtMSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBnZW5lcmF0ZWRQb3NpdGlvbiA9IHNlY3Rpb24uY29uc3VtZXIuZ2VuZXJhdGVkUG9zaXRpb25Gb3IoYUFyZ3MpO1xuICAgICAgICBpZiAoZ2VuZXJhdGVkUG9zaXRpb24pIHtcbiAgICAgICAgICB2YXIgcmV0ID0ge1xuICAgICAgICAgICAgbGluZTogZ2VuZXJhdGVkUG9zaXRpb24ubGluZSArXG4gICAgICAgICAgICAgIChzZWN0aW9uLmdlbmVyYXRlZE9mZnNldC5nZW5lcmF0ZWRMaW5lIC0gMSksXG4gICAgICAgICAgICBjb2x1bW46IGdlbmVyYXRlZFBvc2l0aW9uLmNvbHVtbiArXG4gICAgICAgICAgICAgIChzZWN0aW9uLmdlbmVyYXRlZE9mZnNldC5nZW5lcmF0ZWRMaW5lID09PSBnZW5lcmF0ZWRQb3NpdGlvbi5saW5lXG4gICAgICAgICAgICAgICA/IHNlY3Rpb24uZ2VuZXJhdGVkT2Zmc2V0LmdlbmVyYXRlZENvbHVtbiAtIDFcbiAgICAgICAgICAgICAgIDogMClcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbGluZTogbnVsbCxcbiAgICAgICAgY29sdW1uOiBudWxsXG4gICAgICB9O1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlIHRoZSBtYXBwaW5ncyBpbiBhIHN0cmluZyBpbiB0byBhIGRhdGEgc3RydWN0dXJlIHdoaWNoIHdlIGNhbiBlYXNpbHlcbiAgICogcXVlcnkgKHRoZSBvcmRlcmVkIGFycmF5cyBpbiB0aGUgYHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5nc2AgYW5kXG4gICAqIGB0aGlzLl9fb3JpZ2luYWxNYXBwaW5nc2AgcHJvcGVydGllcykuXG4gICAqL1xuICBJbmRleGVkU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl9wYXJzZU1hcHBpbmdzID1cbiAgICBmdW5jdGlvbiBJbmRleGVkU291cmNlTWFwQ29uc3VtZXJfcGFyc2VNYXBwaW5ncyhhU3RyLCBhU291cmNlUm9vdCkge1xuICAgICAgdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzID0gW107XG4gICAgICB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9zZWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgc2VjdGlvbiA9IHRoaXMuX3NlY3Rpb25zW2ldO1xuICAgICAgICB2YXIgc2VjdGlvbk1hcHBpbmdzID0gc2VjdGlvbi5jb25zdW1lci5fZ2VuZXJhdGVkTWFwcGluZ3M7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgc2VjdGlvbk1hcHBpbmdzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgdmFyIG1hcHBpbmcgPSBzZWN0aW9uTWFwcGluZ3NbaV07XG5cbiAgICAgICAgICB2YXIgc291cmNlID0gc2VjdGlvbi5jb25zdW1lci5fc291cmNlcy5hdChtYXBwaW5nLnNvdXJjZSk7XG4gICAgICAgICAgaWYgKHNlY3Rpb24uY29uc3VtZXIuc291cmNlUm9vdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgc291cmNlID0gdXRpbC5qb2luKHNlY3Rpb24uY29uc3VtZXIuc291cmNlUm9vdCwgc291cmNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fc291cmNlcy5hZGQoc291cmNlKTtcbiAgICAgICAgICBzb3VyY2UgPSB0aGlzLl9zb3VyY2VzLmluZGV4T2Yoc291cmNlKTtcblxuICAgICAgICAgIHZhciBuYW1lID0gc2VjdGlvbi5jb25zdW1lci5fbmFtZXMuYXQobWFwcGluZy5uYW1lKTtcbiAgICAgICAgICB0aGlzLl9uYW1lcy5hZGQobmFtZSk7XG4gICAgICAgICAgbmFtZSA9IHRoaXMuX25hbWVzLmluZGV4T2YobmFtZSk7XG5cbiAgICAgICAgICAvLyBUaGUgbWFwcGluZ3MgY29taW5nIGZyb20gdGhlIGNvbnN1bWVyIGZvciB0aGUgc2VjdGlvbiBoYXZlXG4gICAgICAgICAgLy8gZ2VuZXJhdGVkIHBvc2l0aW9ucyByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIHNlY3Rpb24sIHNvIHdlXG4gICAgICAgICAgLy8gbmVlZCB0byBvZmZzZXQgdGhlbSB0byBiZSByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIGNvbmNhdGVuYXRlZFxuICAgICAgICAgIC8vIGdlbmVyYXRlZCBmaWxlLlxuICAgICAgICAgIHZhciBhZGp1c3RlZE1hcHBpbmcgPSB7XG4gICAgICAgICAgICBzb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICAgIGdlbmVyYXRlZExpbmU6IG1hcHBpbmcuZ2VuZXJhdGVkTGluZSArXG4gICAgICAgICAgICAgIChzZWN0aW9uLmdlbmVyYXRlZE9mZnNldC5nZW5lcmF0ZWRMaW5lIC0gMSksXG4gICAgICAgICAgICBnZW5lcmF0ZWRDb2x1bW46IG1hcHBpbmcuY29sdW1uICtcbiAgICAgICAgICAgICAgKHNlY3Rpb24uZ2VuZXJhdGVkT2Zmc2V0LmdlbmVyYXRlZExpbmUgPT09IG1hcHBpbmcuZ2VuZXJhdGVkTGluZSlcbiAgICAgICAgICAgICAgPyBzZWN0aW9uLmdlbmVyYXRlZE9mZnNldC5nZW5lcmF0ZWRDb2x1bW4gLSAxXG4gICAgICAgICAgICAgIDogMCxcbiAgICAgICAgICAgIG9yaWdpbmFsTGluZTogbWFwcGluZy5vcmlnaW5hbExpbmUsXG4gICAgICAgICAgICBvcmlnaW5hbENvbHVtbjogbWFwcGluZy5vcmlnaW5hbENvbHVtbixcbiAgICAgICAgICAgIG5hbWU6IG5hbWVcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzLnB1c2goYWRqdXN0ZWRNYXBwaW5nKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGFkanVzdGVkTWFwcGluZy5vcmlnaW5hbExpbmUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncy5wdXNoKGFkanVzdGVkTWFwcGluZyk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfTtcblxuICAgICAgcXVpY2tTb3J0KHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncywgdXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNEZWZsYXRlZCk7XG4gICAgICBxdWlja1NvcnQodGhpcy5fX29yaWdpbmFsTWFwcGluZ3MsIHV0aWwuY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMpO1xuICAgIH07XG5cbiAgZXhwb3J0cy5JbmRleGVkU291cmNlTWFwQ29uc3VtZXIgPSBJbmRleGVkU291cmNlTWFwQ29uc3VtZXI7XG5cbn0pO1xuIiwiLyogLSotIE1vZGU6IGpzOyBqcy1pbmRlbnQtbGV2ZWw6IDI7IC0qLSAqL1xuLypcbiAqIENvcHlyaWdodCAyMDExIE1vemlsbGEgRm91bmRhdGlvbiBhbmQgY29udHJpYnV0b3JzXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTmV3IEJTRCBsaWNlbnNlLiBTZWUgTElDRU5TRSBvcjpcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMy1DbGF1c2VcbiAqL1xuaWYgKHR5cGVvZiBkZWZpbmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgZGVmaW5lID0gcmVxdWlyZSgnYW1kZWZpbmUnKShtb2R1bGUsIHJlcXVpcmUpO1xufVxuZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcblxuICB2YXIgYmFzZTY0VkxRID0gcmVxdWlyZSgnLi9iYXNlNjQtdmxxJyk7XG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG4gIHZhciBBcnJheVNldCA9IHJlcXVpcmUoJy4vYXJyYXktc2V0JykuQXJyYXlTZXQ7XG4gIHZhciBNYXBwaW5nTGlzdCA9IHJlcXVpcmUoJy4vbWFwcGluZy1saXN0JykuTWFwcGluZ0xpc3Q7XG5cbiAgLyoqXG4gICAqIEFuIGluc3RhbmNlIG9mIHRoZSBTb3VyY2VNYXBHZW5lcmF0b3IgcmVwcmVzZW50cyBhIHNvdXJjZSBtYXAgd2hpY2ggaXNcbiAgICogYmVpbmcgYnVpbHQgaW5jcmVtZW50YWxseS4gWW91IG1heSBwYXNzIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmdcbiAgICogcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIGZpbGU6IFRoZSBmaWxlbmFtZSBvZiB0aGUgZ2VuZXJhdGVkIHNvdXJjZS5cbiAgICogICAtIHNvdXJjZVJvb3Q6IEEgcm9vdCBmb3IgYWxsIHJlbGF0aXZlIFVSTHMgaW4gdGhpcyBzb3VyY2UgbWFwLlxuICAgKi9cbiAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yKGFBcmdzKSB7XG4gICAgaWYgKCFhQXJncykge1xuICAgICAgYUFyZ3MgPSB7fTtcbiAgICB9XG4gICAgdGhpcy5fZmlsZSA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnZmlsZScsIG51bGwpO1xuICAgIHRoaXMuX3NvdXJjZVJvb3QgPSB1dGlsLmdldEFyZyhhQXJncywgJ3NvdXJjZVJvb3QnLCBudWxsKTtcbiAgICB0aGlzLl9za2lwVmFsaWRhdGlvbiA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnc2tpcFZhbGlkYXRpb24nLCBmYWxzZSk7XG4gICAgdGhpcy5fc291cmNlcyA9IG5ldyBBcnJheVNldCgpO1xuICAgIHRoaXMuX25hbWVzID0gbmV3IEFycmF5U2V0KCk7XG4gICAgdGhpcy5fbWFwcGluZ3MgPSBuZXcgTWFwcGluZ0xpc3QoKTtcbiAgICB0aGlzLl9zb3VyY2VzQ29udGVudHMgPSBudWxsO1xuICB9XG5cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5fdmVyc2lvbiA9IDM7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgU291cmNlTWFwR2VuZXJhdG9yIGJhc2VkIG9uIGEgU291cmNlTWFwQ29uc3VtZXJcbiAgICpcbiAgICogQHBhcmFtIGFTb3VyY2VNYXBDb25zdW1lciBUaGUgU291cmNlTWFwLlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLmZyb21Tb3VyY2VNYXAgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl9mcm9tU291cmNlTWFwKGFTb3VyY2VNYXBDb25zdW1lcikge1xuICAgICAgdmFyIHNvdXJjZVJvb3QgPSBhU291cmNlTWFwQ29uc3VtZXIuc291cmNlUm9vdDtcbiAgICAgIHZhciBnZW5lcmF0b3IgPSBuZXcgU291cmNlTWFwR2VuZXJhdG9yKHtcbiAgICAgICAgZmlsZTogYVNvdXJjZU1hcENvbnN1bWVyLmZpbGUsXG4gICAgICAgIHNvdXJjZVJvb3Q6IHNvdXJjZVJvb3RcbiAgICAgIH0pO1xuICAgICAgYVNvdXJjZU1hcENvbnN1bWVyLmVhY2hNYXBwaW5nKGZ1bmN0aW9uIChtYXBwaW5nKSB7XG4gICAgICAgIHZhciBuZXdNYXBwaW5nID0ge1xuICAgICAgICAgIGdlbmVyYXRlZDoge1xuICAgICAgICAgICAgbGluZTogbWFwcGluZy5nZW5lcmF0ZWRMaW5lLFxuICAgICAgICAgICAgY29sdW1uOiBtYXBwaW5nLmdlbmVyYXRlZENvbHVtblxuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAobWFwcGluZy5zb3VyY2UgIT0gbnVsbCkge1xuICAgICAgICAgIG5ld01hcHBpbmcuc291cmNlID0gbWFwcGluZy5zb3VyY2U7XG4gICAgICAgICAgaWYgKHNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICAgICAgbmV3TWFwcGluZy5zb3VyY2UgPSB1dGlsLnJlbGF0aXZlKHNvdXJjZVJvb3QsIG5ld01hcHBpbmcuc291cmNlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBuZXdNYXBwaW5nLm9yaWdpbmFsID0ge1xuICAgICAgICAgICAgbGluZTogbWFwcGluZy5vcmlnaW5hbExpbmUsXG4gICAgICAgICAgICBjb2x1bW46IG1hcHBpbmcub3JpZ2luYWxDb2x1bW5cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgaWYgKG1hcHBpbmcubmFtZSAhPSBudWxsKSB7XG4gICAgICAgICAgICBuZXdNYXBwaW5nLm5hbWUgPSBtYXBwaW5nLm5hbWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ2VuZXJhdG9yLmFkZE1hcHBpbmcobmV3TWFwcGluZyk7XG4gICAgICB9KTtcbiAgICAgIGFTb3VyY2VNYXBDb25zdW1lci5zb3VyY2VzLmZvckVhY2goZnVuY3Rpb24gKHNvdXJjZUZpbGUpIHtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSBhU291cmNlTWFwQ29uc3VtZXIuc291cmNlQ29udGVudEZvcihzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGNvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIGdlbmVyYXRvci5zZXRTb3VyY2VDb250ZW50KHNvdXJjZUZpbGUsIGNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBnZW5lcmF0b3I7XG4gICAgfTtcblxuICAvKipcbiAgICogQWRkIGEgc2luZ2xlIG1hcHBpbmcgZnJvbSBvcmlnaW5hbCBzb3VyY2UgbGluZSBhbmQgY29sdW1uIHRvIHRoZSBnZW5lcmF0ZWRcbiAgICogc291cmNlJ3MgbGluZSBhbmQgY29sdW1uIGZvciB0aGlzIHNvdXJjZSBtYXAgYmVpbmcgY3JlYXRlZC4gVGhlIG1hcHBpbmdcbiAgICogb2JqZWN0IHNob3VsZCBoYXZlIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIGdlbmVyYXRlZDogQW4gb2JqZWN0IHdpdGggdGhlIGdlbmVyYXRlZCBsaW5lIGFuZCBjb2x1bW4gcG9zaXRpb25zLlxuICAgKiAgIC0gb3JpZ2luYWw6IEFuIG9iamVjdCB3aXRoIHRoZSBvcmlnaW5hbCBsaW5lIGFuZCBjb2x1bW4gcG9zaXRpb25zLlxuICAgKiAgIC0gc291cmNlOiBUaGUgb3JpZ2luYWwgc291cmNlIGZpbGUgKHJlbGF0aXZlIHRvIHRoZSBzb3VyY2VSb290KS5cbiAgICogICAtIG5hbWU6IEFuIG9wdGlvbmFsIG9yaWdpbmFsIHRva2VuIG5hbWUgZm9yIHRoaXMgbWFwcGluZy5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuYWRkTWFwcGluZyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX2FkZE1hcHBpbmcoYUFyZ3MpIHtcbiAgICAgIHZhciBnZW5lcmF0ZWQgPSB1dGlsLmdldEFyZyhhQXJncywgJ2dlbmVyYXRlZCcpO1xuICAgICAgdmFyIG9yaWdpbmFsID0gdXRpbC5nZXRBcmcoYUFyZ3MsICdvcmlnaW5hbCcsIG51bGwpO1xuICAgICAgdmFyIHNvdXJjZSA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnc291cmNlJywgbnVsbCk7XG4gICAgICB2YXIgbmFtZSA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnbmFtZScsIG51bGwpO1xuXG4gICAgICBpZiAoIXRoaXMuX3NraXBWYWxpZGF0aW9uKSB7XG4gICAgICAgIHRoaXMuX3ZhbGlkYXRlTWFwcGluZyhnZW5lcmF0ZWQsIG9yaWdpbmFsLCBzb3VyY2UsIG5hbWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc291cmNlICE9IG51bGwgJiYgIXRoaXMuX3NvdXJjZXMuaGFzKHNvdXJjZSkpIHtcbiAgICAgICAgdGhpcy5fc291cmNlcy5hZGQoc291cmNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5hbWUgIT0gbnVsbCAmJiAhdGhpcy5fbmFtZXMuaGFzKG5hbWUpKSB7XG4gICAgICAgIHRoaXMuX25hbWVzLmFkZChuYW1lKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fbWFwcGluZ3MuYWRkKHtcbiAgICAgICAgZ2VuZXJhdGVkTGluZTogZ2VuZXJhdGVkLmxpbmUsXG4gICAgICAgIGdlbmVyYXRlZENvbHVtbjogZ2VuZXJhdGVkLmNvbHVtbixcbiAgICAgICAgb3JpZ2luYWxMaW5lOiBvcmlnaW5hbCAhPSBudWxsICYmIG9yaWdpbmFsLmxpbmUsXG4gICAgICAgIG9yaWdpbmFsQ29sdW1uOiBvcmlnaW5hbCAhPSBudWxsICYmIG9yaWdpbmFsLmNvbHVtbixcbiAgICAgICAgc291cmNlOiBzb3VyY2UsXG4gICAgICAgIG5hbWU6IG5hbWVcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgc291cmNlIGNvbnRlbnQgZm9yIGEgc291cmNlIGZpbGUuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLnNldFNvdXJjZUNvbnRlbnQgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl9zZXRTb3VyY2VDb250ZW50KGFTb3VyY2VGaWxlLCBhU291cmNlQ29udGVudCkge1xuICAgICAgdmFyIHNvdXJjZSA9IGFTb3VyY2VGaWxlO1xuICAgICAgaWYgKHRoaXMuX3NvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBzb3VyY2UgPSB1dGlsLnJlbGF0aXZlKHRoaXMuX3NvdXJjZVJvb3QsIHNvdXJjZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChhU291cmNlQ29udGVudCAhPSBudWxsKSB7XG4gICAgICAgIC8vIEFkZCB0aGUgc291cmNlIGNvbnRlbnQgdG8gdGhlIF9zb3VyY2VzQ29udGVudHMgbWFwLlxuICAgICAgICAvLyBDcmVhdGUgYSBuZXcgX3NvdXJjZXNDb250ZW50cyBtYXAgaWYgdGhlIHByb3BlcnR5IGlzIG51bGwuXG4gICAgICAgIGlmICghdGhpcy5fc291cmNlc0NvbnRlbnRzKSB7XG4gICAgICAgICAgdGhpcy5fc291cmNlc0NvbnRlbnRzID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc291cmNlc0NvbnRlbnRzW3V0aWwudG9TZXRTdHJpbmcoc291cmNlKV0gPSBhU291cmNlQ29udGVudDtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fc291cmNlc0NvbnRlbnRzKSB7XG4gICAgICAgIC8vIFJlbW92ZSB0aGUgc291cmNlIGZpbGUgZnJvbSB0aGUgX3NvdXJjZXNDb250ZW50cyBtYXAuXG4gICAgICAgIC8vIElmIHRoZSBfc291cmNlc0NvbnRlbnRzIG1hcCBpcyBlbXB0eSwgc2V0IHRoZSBwcm9wZXJ0eSB0byBudWxsLlxuICAgICAgICBkZWxldGUgdGhpcy5fc291cmNlc0NvbnRlbnRzW3V0aWwudG9TZXRTdHJpbmcoc291cmNlKV07XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9zb3VyY2VzQ29udGVudHMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuX3NvdXJjZXNDb250ZW50cyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gIC8qKlxuICAgKiBBcHBsaWVzIHRoZSBtYXBwaW5ncyBvZiBhIHN1Yi1zb3VyY2UtbWFwIGZvciBhIHNwZWNpZmljIHNvdXJjZSBmaWxlIHRvIHRoZVxuICAgKiBzb3VyY2UgbWFwIGJlaW5nIGdlbmVyYXRlZC4gRWFjaCBtYXBwaW5nIHRvIHRoZSBzdXBwbGllZCBzb3VyY2UgZmlsZSBpc1xuICAgKiByZXdyaXR0ZW4gdXNpbmcgdGhlIHN1cHBsaWVkIHNvdXJjZSBtYXAuIE5vdGU6IFRoZSByZXNvbHV0aW9uIGZvciB0aGVcbiAgICogcmVzdWx0aW5nIG1hcHBpbmdzIGlzIHRoZSBtaW5pbWl1bSBvZiB0aGlzIG1hcCBhbmQgdGhlIHN1cHBsaWVkIG1hcC5cbiAgICpcbiAgICogQHBhcmFtIGFTb3VyY2VNYXBDb25zdW1lciBUaGUgc291cmNlIG1hcCB0byBiZSBhcHBsaWVkLlxuICAgKiBAcGFyYW0gYVNvdXJjZUZpbGUgT3B0aW9uYWwuIFRoZSBmaWxlbmFtZSBvZiB0aGUgc291cmNlIGZpbGUuXG4gICAqICAgICAgICBJZiBvbWl0dGVkLCBTb3VyY2VNYXBDb25zdW1lcidzIGZpbGUgcHJvcGVydHkgd2lsbCBiZSB1c2VkLlxuICAgKiBAcGFyYW0gYVNvdXJjZU1hcFBhdGggT3B0aW9uYWwuIFRoZSBkaXJuYW1lIG9mIHRoZSBwYXRoIHRvIHRoZSBzb3VyY2UgbWFwXG4gICAqICAgICAgICB0byBiZSBhcHBsaWVkLiBJZiByZWxhdGl2ZSwgaXQgaXMgcmVsYXRpdmUgdG8gdGhlIFNvdXJjZU1hcENvbnN1bWVyLlxuICAgKiAgICAgICAgVGhpcyBwYXJhbWV0ZXIgaXMgbmVlZGVkIHdoZW4gdGhlIHR3byBzb3VyY2UgbWFwcyBhcmVuJ3QgaW4gdGhlIHNhbWVcbiAgICogICAgICAgIGRpcmVjdG9yeSwgYW5kIHRoZSBzb3VyY2UgbWFwIHRvIGJlIGFwcGxpZWQgY29udGFpbnMgcmVsYXRpdmUgc291cmNlXG4gICAqICAgICAgICBwYXRocy4gSWYgc28sIHRob3NlIHJlbGF0aXZlIHNvdXJjZSBwYXRocyBuZWVkIHRvIGJlIHJld3JpdHRlblxuICAgKiAgICAgICAgcmVsYXRpdmUgdG8gdGhlIFNvdXJjZU1hcEdlbmVyYXRvci5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuYXBwbHlTb3VyY2VNYXAgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl9hcHBseVNvdXJjZU1hcChhU291cmNlTWFwQ29uc3VtZXIsIGFTb3VyY2VGaWxlLCBhU291cmNlTWFwUGF0aCkge1xuICAgICAgdmFyIHNvdXJjZUZpbGUgPSBhU291cmNlRmlsZTtcbiAgICAgIC8vIElmIGFTb3VyY2VGaWxlIGlzIG9taXR0ZWQsIHdlIHdpbGwgdXNlIHRoZSBmaWxlIHByb3BlcnR5IG9mIHRoZSBTb3VyY2VNYXBcbiAgICAgIGlmIChhU291cmNlRmlsZSA9PSBudWxsKSB7XG4gICAgICAgIGlmIChhU291cmNlTWFwQ29uc3VtZXIuZmlsZSA9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ1NvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuYXBwbHlTb3VyY2VNYXAgcmVxdWlyZXMgZWl0aGVyIGFuIGV4cGxpY2l0IHNvdXJjZSBmaWxlLCAnICtcbiAgICAgICAgICAgICdvciB0aGUgc291cmNlIG1hcFxcJ3MgXCJmaWxlXCIgcHJvcGVydHkuIEJvdGggd2VyZSBvbWl0dGVkLidcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZUZpbGUgPSBhU291cmNlTWFwQ29uc3VtZXIuZmlsZTtcbiAgICAgIH1cbiAgICAgIHZhciBzb3VyY2VSb290ID0gdGhpcy5fc291cmNlUm9vdDtcbiAgICAgIC8vIE1ha2UgXCJzb3VyY2VGaWxlXCIgcmVsYXRpdmUgaWYgYW4gYWJzb2x1dGUgVXJsIGlzIHBhc3NlZC5cbiAgICAgIGlmIChzb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgc291cmNlRmlsZSA9IHV0aWwucmVsYXRpdmUoc291cmNlUm9vdCwgc291cmNlRmlsZSk7XG4gICAgICB9XG4gICAgICAvLyBBcHBseWluZyB0aGUgU291cmNlTWFwIGNhbiBhZGQgYW5kIHJlbW92ZSBpdGVtcyBmcm9tIHRoZSBzb3VyY2VzIGFuZFxuICAgICAgLy8gdGhlIG5hbWVzIGFycmF5LlxuICAgICAgdmFyIG5ld1NvdXJjZXMgPSBuZXcgQXJyYXlTZXQoKTtcbiAgICAgIHZhciBuZXdOYW1lcyA9IG5ldyBBcnJheVNldCgpO1xuXG4gICAgICAvLyBGaW5kIG1hcHBpbmdzIGZvciB0aGUgXCJzb3VyY2VGaWxlXCJcbiAgICAgIHRoaXMuX21hcHBpbmdzLnVuc29ydGVkRm9yRWFjaChmdW5jdGlvbiAobWFwcGluZykge1xuICAgICAgICBpZiAobWFwcGluZy5zb3VyY2UgPT09IHNvdXJjZUZpbGUgJiYgbWFwcGluZy5vcmlnaW5hbExpbmUgIT0gbnVsbCkge1xuICAgICAgICAgIC8vIENoZWNrIGlmIGl0IGNhbiBiZSBtYXBwZWQgYnkgdGhlIHNvdXJjZSBtYXAsIHRoZW4gdXBkYXRlIHRoZSBtYXBwaW5nLlxuICAgICAgICAgIHZhciBvcmlnaW5hbCA9IGFTb3VyY2VNYXBDb25zdW1lci5vcmlnaW5hbFBvc2l0aW9uRm9yKHtcbiAgICAgICAgICAgIGxpbmU6IG1hcHBpbmcub3JpZ2luYWxMaW5lLFxuICAgICAgICAgICAgY29sdW1uOiBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKG9yaWdpbmFsLnNvdXJjZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBDb3B5IG1hcHBpbmdcbiAgICAgICAgICAgIG1hcHBpbmcuc291cmNlID0gb3JpZ2luYWwuc291cmNlO1xuICAgICAgICAgICAgaWYgKGFTb3VyY2VNYXBQYXRoICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgbWFwcGluZy5zb3VyY2UgPSB1dGlsLmpvaW4oYVNvdXJjZU1hcFBhdGgsIG1hcHBpbmcuc291cmNlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBtYXBwaW5nLnNvdXJjZSA9IHV0aWwucmVsYXRpdmUoc291cmNlUm9vdCwgbWFwcGluZy5zb3VyY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWFwcGluZy5vcmlnaW5hbExpbmUgPSBvcmlnaW5hbC5saW5lO1xuICAgICAgICAgICAgbWFwcGluZy5vcmlnaW5hbENvbHVtbiA9IG9yaWdpbmFsLmNvbHVtbjtcbiAgICAgICAgICAgIGlmIChvcmlnaW5hbC5uYW1lICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgbWFwcGluZy5uYW1lID0gb3JpZ2luYWwubmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc291cmNlID0gbWFwcGluZy5zb3VyY2U7XG4gICAgICAgIGlmIChzb3VyY2UgIT0gbnVsbCAmJiAhbmV3U291cmNlcy5oYXMoc291cmNlKSkge1xuICAgICAgICAgIG5ld1NvdXJjZXMuYWRkKHNvdXJjZSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmFtZSA9IG1hcHBpbmcubmFtZTtcbiAgICAgICAgaWYgKG5hbWUgIT0gbnVsbCAmJiAhbmV3TmFtZXMuaGFzKG5hbWUpKSB7XG4gICAgICAgICAgbmV3TmFtZXMuYWRkKG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgIH0sIHRoaXMpO1xuICAgICAgdGhpcy5fc291cmNlcyA9IG5ld1NvdXJjZXM7XG4gICAgICB0aGlzLl9uYW1lcyA9IG5ld05hbWVzO1xuXG4gICAgICAvLyBDb3B5IHNvdXJjZXNDb250ZW50cyBvZiBhcHBsaWVkIG1hcC5cbiAgICAgIGFTb3VyY2VNYXBDb25zdW1lci5zb3VyY2VzLmZvckVhY2goZnVuY3Rpb24gKHNvdXJjZUZpbGUpIHtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSBhU291cmNlTWFwQ29uc3VtZXIuc291cmNlQ29udGVudEZvcihzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGNvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIGlmIChhU291cmNlTWFwUGF0aCAhPSBudWxsKSB7XG4gICAgICAgICAgICBzb3VyY2VGaWxlID0gdXRpbC5qb2luKGFTb3VyY2VNYXBQYXRoLCBzb3VyY2VGaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICAgICAgc291cmNlRmlsZSA9IHV0aWwucmVsYXRpdmUoc291cmNlUm9vdCwgc291cmNlRmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuc2V0U291cmNlQ29udGVudChzb3VyY2VGaWxlLCBjb250ZW50KTtcbiAgICAgICAgfVxuICAgICAgfSwgdGhpcyk7XG4gICAgfTtcblxuICAvKipcbiAgICogQSBtYXBwaW5nIGNhbiBoYXZlIG9uZSBvZiB0aGUgdGhyZWUgbGV2ZWxzIG9mIGRhdGE6XG4gICAqXG4gICAqICAgMS4gSnVzdCB0aGUgZ2VuZXJhdGVkIHBvc2l0aW9uLlxuICAgKiAgIDIuIFRoZSBHZW5lcmF0ZWQgcG9zaXRpb24sIG9yaWdpbmFsIHBvc2l0aW9uLCBhbmQgb3JpZ2luYWwgc291cmNlLlxuICAgKiAgIDMuIEdlbmVyYXRlZCBhbmQgb3JpZ2luYWwgcG9zaXRpb24sIG9yaWdpbmFsIHNvdXJjZSwgYXMgd2VsbCBhcyBhIG5hbWVcbiAgICogICAgICB0b2tlbi5cbiAgICpcbiAgICogVG8gbWFpbnRhaW4gY29uc2lzdGVuY3ksIHdlIHZhbGlkYXRlIHRoYXQgYW55IG5ldyBtYXBwaW5nIGJlaW5nIGFkZGVkIGZhbGxzXG4gICAqIGluIHRvIG9uZSBvZiB0aGVzZSBjYXRlZ29yaWVzLlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5fdmFsaWRhdGVNYXBwaW5nID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3JfdmFsaWRhdGVNYXBwaW5nKGFHZW5lcmF0ZWQsIGFPcmlnaW5hbCwgYVNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFOYW1lKSB7XG4gICAgICBpZiAoYUdlbmVyYXRlZCAmJiAnbGluZScgaW4gYUdlbmVyYXRlZCAmJiAnY29sdW1uJyBpbiBhR2VuZXJhdGVkXG4gICAgICAgICAgJiYgYUdlbmVyYXRlZC5saW5lID4gMCAmJiBhR2VuZXJhdGVkLmNvbHVtbiA+PSAwXG4gICAgICAgICAgJiYgIWFPcmlnaW5hbCAmJiAhYVNvdXJjZSAmJiAhYU5hbWUpIHtcbiAgICAgICAgLy8gQ2FzZSAxLlxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChhR2VuZXJhdGVkICYmICdsaW5lJyBpbiBhR2VuZXJhdGVkICYmICdjb2x1bW4nIGluIGFHZW5lcmF0ZWRcbiAgICAgICAgICAgICAgICYmIGFPcmlnaW5hbCAmJiAnbGluZScgaW4gYU9yaWdpbmFsICYmICdjb2x1bW4nIGluIGFPcmlnaW5hbFxuICAgICAgICAgICAgICAgJiYgYUdlbmVyYXRlZC5saW5lID4gMCAmJiBhR2VuZXJhdGVkLmNvbHVtbiA+PSAwXG4gICAgICAgICAgICAgICAmJiBhT3JpZ2luYWwubGluZSA+IDAgJiYgYU9yaWdpbmFsLmNvbHVtbiA+PSAwXG4gICAgICAgICAgICAgICAmJiBhU291cmNlKSB7XG4gICAgICAgIC8vIENhc2VzIDIgYW5kIDMuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbWFwcGluZzogJyArIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBnZW5lcmF0ZWQ6IGFHZW5lcmF0ZWQsXG4gICAgICAgICAgc291cmNlOiBhU291cmNlLFxuICAgICAgICAgIG9yaWdpbmFsOiBhT3JpZ2luYWwsXG4gICAgICAgICAgbmFtZTogYU5hbWVcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0aGUgYWNjdW11bGF0ZWQgbWFwcGluZ3MgaW4gdG8gdGhlIHN0cmVhbSBvZiBiYXNlIDY0IFZMUXNcbiAgICogc3BlY2lmaWVkIGJ5IHRoZSBzb3VyY2UgbWFwIGZvcm1hdC5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuX3NlcmlhbGl6ZU1hcHBpbmdzID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3Jfc2VyaWFsaXplTWFwcGluZ3MoKSB7XG4gICAgICB2YXIgcHJldmlvdXNHZW5lcmF0ZWRDb2x1bW4gPSAwO1xuICAgICAgdmFyIHByZXZpb3VzR2VuZXJhdGVkTGluZSA9IDE7XG4gICAgICB2YXIgcHJldmlvdXNPcmlnaW5hbENvbHVtbiA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNPcmlnaW5hbExpbmUgPSAwO1xuICAgICAgdmFyIHByZXZpb3VzTmFtZSA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNTb3VyY2UgPSAwO1xuICAgICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgICAgdmFyIG1hcHBpbmc7XG5cbiAgICAgIHZhciBtYXBwaW5ncyA9IHRoaXMuX21hcHBpbmdzLnRvQXJyYXkoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBtYXBwaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBtYXBwaW5nID0gbWFwcGluZ3NbaV07XG5cbiAgICAgICAgaWYgKG1hcHBpbmcuZ2VuZXJhdGVkTGluZSAhPT0gcHJldmlvdXNHZW5lcmF0ZWRMaW5lKSB7XG4gICAgICAgICAgcHJldmlvdXNHZW5lcmF0ZWRDb2x1bW4gPSAwO1xuICAgICAgICAgIHdoaWxlIChtYXBwaW5nLmdlbmVyYXRlZExpbmUgIT09IHByZXZpb3VzR2VuZXJhdGVkTGluZSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9ICc7JztcbiAgICAgICAgICAgIHByZXZpb3VzR2VuZXJhdGVkTGluZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICAgIGlmICghdXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNJbmZsYXRlZChtYXBwaW5nLCBtYXBwaW5nc1tpIC0gMV0pKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0ICs9ICcsJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQgKz0gYmFzZTY0VkxRLmVuY29kZShtYXBwaW5nLmdlbmVyYXRlZENvbHVtblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtIHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uKTtcbiAgICAgICAgcHJldmlvdXNHZW5lcmF0ZWRDb2x1bW4gPSBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbjtcblxuICAgICAgICBpZiAobWFwcGluZy5zb3VyY2UgIT0gbnVsbCkge1xuICAgICAgICAgIHJlc3VsdCArPSBiYXNlNjRWTFEuZW5jb2RlKHRoaXMuX3NvdXJjZXMuaW5kZXhPZihtYXBwaW5nLnNvdXJjZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtIHByZXZpb3VzU291cmNlKTtcbiAgICAgICAgICBwcmV2aW91c1NvdXJjZSA9IHRoaXMuX3NvdXJjZXMuaW5kZXhPZihtYXBwaW5nLnNvdXJjZSk7XG5cbiAgICAgICAgICAvLyBsaW5lcyBhcmUgc3RvcmVkIDAtYmFzZWQgaW4gU291cmNlTWFwIHNwZWMgdmVyc2lvbiAzXG4gICAgICAgICAgcmVzdWx0ICs9IGJhc2U2NFZMUS5lbmNvZGUobWFwcGluZy5vcmlnaW5hbExpbmUgLSAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLSBwcmV2aW91c09yaWdpbmFsTGluZSk7XG4gICAgICAgICAgcHJldmlvdXNPcmlnaW5hbExpbmUgPSBtYXBwaW5nLm9yaWdpbmFsTGluZSAtIDE7XG5cbiAgICAgICAgICByZXN1bHQgKz0gYmFzZTY0VkxRLmVuY29kZShtYXBwaW5nLm9yaWdpbmFsQ29sdW1uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLSBwcmV2aW91c09yaWdpbmFsQ29sdW1uKTtcbiAgICAgICAgICBwcmV2aW91c09yaWdpbmFsQ29sdW1uID0gbWFwcGluZy5vcmlnaW5hbENvbHVtbjtcblxuICAgICAgICAgIGlmIChtYXBwaW5nLm5hbWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IGJhc2U2NFZMUS5lbmNvZGUodGhpcy5fbmFtZXMuaW5kZXhPZihtYXBwaW5nLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtIHByZXZpb3VzTmFtZSk7XG4gICAgICAgICAgICBwcmV2aW91c05hbWUgPSB0aGlzLl9uYW1lcy5pbmRleE9mKG1hcHBpbmcubmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLl9nZW5lcmF0ZVNvdXJjZXNDb250ZW50ID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3JfZ2VuZXJhdGVTb3VyY2VzQ29udGVudChhU291cmNlcywgYVNvdXJjZVJvb3QpIHtcbiAgICAgIHJldHVybiBhU291cmNlcy5tYXAoZnVuY3Rpb24gKHNvdXJjZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3NvdXJjZXNDb250ZW50cykge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhU291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgICAgc291cmNlID0gdXRpbC5yZWxhdGl2ZShhU291cmNlUm9vdCwgc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIga2V5ID0gdXRpbC50b1NldFN0cmluZyhzb3VyY2UpO1xuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMuX3NvdXJjZXNDb250ZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkpXG4gICAgICAgICAgPyB0aGlzLl9zb3VyY2VzQ29udGVudHNba2V5XVxuICAgICAgICAgIDogbnVsbDtcbiAgICAgIH0sIHRoaXMpO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIEV4dGVybmFsaXplIHRoZSBzb3VyY2UgbWFwLlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS50b0pTT04gPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl90b0pTT04oKSB7XG4gICAgICB2YXIgbWFwID0ge1xuICAgICAgICB2ZXJzaW9uOiB0aGlzLl92ZXJzaW9uLFxuICAgICAgICBzb3VyY2VzOiB0aGlzLl9zb3VyY2VzLnRvQXJyYXkoKSxcbiAgICAgICAgbmFtZXM6IHRoaXMuX25hbWVzLnRvQXJyYXkoKSxcbiAgICAgICAgbWFwcGluZ3M6IHRoaXMuX3NlcmlhbGl6ZU1hcHBpbmdzKClcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZmlsZSAhPSBudWxsKSB7XG4gICAgICAgIG1hcC5maWxlID0gdGhpcy5fZmlsZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9zb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgbWFwLnNvdXJjZVJvb3QgPSB0aGlzLl9zb3VyY2VSb290O1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX3NvdXJjZXNDb250ZW50cykge1xuICAgICAgICBtYXAuc291cmNlc0NvbnRlbnQgPSB0aGlzLl9nZW5lcmF0ZVNvdXJjZXNDb250ZW50KG1hcC5zb3VyY2VzLCBtYXAuc291cmNlUm9vdCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtYXA7XG4gICAgfTtcblxuICAvKipcbiAgICogUmVuZGVyIHRoZSBzb3VyY2UgbWFwIGJlaW5nIGdlbmVyYXRlZCB0byBhIHN0cmluZy5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUudG9TdHJpbmcgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl90b1N0cmluZygpIHtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLnRvSlNPTigpKTtcbiAgICB9O1xuXG4gIGV4cG9ydHMuU291cmNlTWFwR2VuZXJhdG9yID0gU291cmNlTWFwR2VuZXJhdG9yO1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIFNvdXJjZU1hcEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vc291cmNlLW1hcC1nZW5lcmF0b3InKS5Tb3VyY2VNYXBHZW5lcmF0b3I7XG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbiAgLy8gTWF0Y2hlcyBhIFdpbmRvd3Mtc3R5bGUgYFxcclxcbmAgbmV3bGluZSBvciBhIGBcXG5gIG5ld2xpbmUgdXNlZCBieSBhbGwgb3RoZXJcbiAgLy8gb3BlcmF0aW5nIHN5c3RlbXMgdGhlc2UgZGF5cyAoY2FwdHVyaW5nIHRoZSByZXN1bHQpLlxuICB2YXIgUkVHRVhfTkVXTElORSA9IC8oXFxyP1xcbikvO1xuXG4gIC8vIE5ld2xpbmUgY2hhcmFjdGVyIGNvZGUgZm9yIGNoYXJDb2RlQXQoKSBjb21wYXJpc29uc1xuICB2YXIgTkVXTElORV9DT0RFID0gMTA7XG5cbiAgLy8gUHJpdmF0ZSBzeW1ib2wgZm9yIGlkZW50aWZ5aW5nIGBTb3VyY2VOb2RlYHMgd2hlbiBtdWx0aXBsZSB2ZXJzaW9ucyBvZlxuICAvLyB0aGUgc291cmNlLW1hcCBsaWJyYXJ5IGFyZSBsb2FkZWQuIFRoaXMgTVVTVCBOT1QgQ0hBTkdFIGFjcm9zc1xuICAvLyB2ZXJzaW9ucyFcbiAgdmFyIGlzU291cmNlTm9kZSA9IFwiJCQkaXNTb3VyY2VOb2RlJCQkXCI7XG5cbiAgLyoqXG4gICAqIFNvdXJjZU5vZGVzIHByb3ZpZGUgYSB3YXkgdG8gYWJzdHJhY3Qgb3ZlciBpbnRlcnBvbGF0aW5nL2NvbmNhdGVuYXRpbmdcbiAgICogc25pcHBldHMgb2YgZ2VuZXJhdGVkIEphdmFTY3JpcHQgc291cmNlIGNvZGUgd2hpbGUgbWFpbnRhaW5pbmcgdGhlIGxpbmUgYW5kXG4gICAqIGNvbHVtbiBpbmZvcm1hdGlvbiBhc3NvY2lhdGVkIHdpdGggdGhlIG9yaWdpbmFsIHNvdXJjZSBjb2RlLlxuICAgKlxuICAgKiBAcGFyYW0gYUxpbmUgVGhlIG9yaWdpbmFsIGxpbmUgbnVtYmVyLlxuICAgKiBAcGFyYW0gYUNvbHVtbiBUaGUgb3JpZ2luYWwgY29sdW1uIG51bWJlci5cbiAgICogQHBhcmFtIGFTb3VyY2UgVGhlIG9yaWdpbmFsIHNvdXJjZSdzIGZpbGVuYW1lLlxuICAgKiBAcGFyYW0gYUNodW5rcyBPcHRpb25hbC4gQW4gYXJyYXkgb2Ygc3RyaW5ncyB3aGljaCBhcmUgc25pcHBldHMgb2ZcbiAgICogICAgICAgIGdlbmVyYXRlZCBKUywgb3Igb3RoZXIgU291cmNlTm9kZXMuXG4gICAqIEBwYXJhbSBhTmFtZSBUaGUgb3JpZ2luYWwgaWRlbnRpZmllci5cbiAgICovXG4gIGZ1bmN0aW9uIFNvdXJjZU5vZGUoYUxpbmUsIGFDb2x1bW4sIGFTb3VyY2UsIGFDaHVua3MsIGFOYW1lKSB7XG4gICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgIHRoaXMuc291cmNlQ29udGVudHMgPSB7fTtcbiAgICB0aGlzLmxpbmUgPSBhTGluZSA9PSBudWxsID8gbnVsbCA6IGFMaW5lO1xuICAgIHRoaXMuY29sdW1uID0gYUNvbHVtbiA9PSBudWxsID8gbnVsbCA6IGFDb2x1bW47XG4gICAgdGhpcy5zb3VyY2UgPSBhU291cmNlID09IG51bGwgPyBudWxsIDogYVNvdXJjZTtcbiAgICB0aGlzLm5hbWUgPSBhTmFtZSA9PSBudWxsID8gbnVsbCA6IGFOYW1lO1xuICAgIHRoaXNbaXNTb3VyY2VOb2RlXSA9IHRydWU7XG4gICAgaWYgKGFDaHVua3MgIT0gbnVsbCkgdGhpcy5hZGQoYUNodW5rcyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIFNvdXJjZU5vZGUgZnJvbSBnZW5lcmF0ZWQgY29kZSBhbmQgYSBTb3VyY2VNYXBDb25zdW1lci5cbiAgICpcbiAgICogQHBhcmFtIGFHZW5lcmF0ZWRDb2RlIFRoZSBnZW5lcmF0ZWQgY29kZVxuICAgKiBAcGFyYW0gYVNvdXJjZU1hcENvbnN1bWVyIFRoZSBTb3VyY2VNYXAgZm9yIHRoZSBnZW5lcmF0ZWQgY29kZVxuICAgKiBAcGFyYW0gYVJlbGF0aXZlUGF0aCBPcHRpb25hbC4gVGhlIHBhdGggdGhhdCByZWxhdGl2ZSBzb3VyY2VzIGluIHRoZVxuICAgKiAgICAgICAgU291cmNlTWFwQ29uc3VtZXIgc2hvdWxkIGJlIHJlbGF0aXZlIHRvLlxuICAgKi9cbiAgU291cmNlTm9kZS5mcm9tU3RyaW5nV2l0aFNvdXJjZU1hcCA9XG4gICAgZnVuY3Rpb24gU291cmNlTm9kZV9mcm9tU3RyaW5nV2l0aFNvdXJjZU1hcChhR2VuZXJhdGVkQ29kZSwgYVNvdXJjZU1hcENvbnN1bWVyLCBhUmVsYXRpdmVQYXRoKSB7XG4gICAgICAvLyBUaGUgU291cmNlTm9kZSB3ZSB3YW50IHRvIGZpbGwgd2l0aCB0aGUgZ2VuZXJhdGVkIGNvZGVcbiAgICAgIC8vIGFuZCB0aGUgU291cmNlTWFwXG4gICAgICB2YXIgbm9kZSA9IG5ldyBTb3VyY2VOb2RlKCk7XG5cbiAgICAgIC8vIEFsbCBldmVuIGluZGljZXMgb2YgdGhpcyBhcnJheSBhcmUgb25lIGxpbmUgb2YgdGhlIGdlbmVyYXRlZCBjb2RlLFxuICAgICAgLy8gd2hpbGUgYWxsIG9kZCBpbmRpY2VzIGFyZSB0aGUgbmV3bGluZXMgYmV0d2VlbiB0d28gYWRqYWNlbnQgbGluZXNcbiAgICAgIC8vIChzaW5jZSBgUkVHRVhfTkVXTElORWAgY2FwdHVyZXMgaXRzIG1hdGNoKS5cbiAgICAgIC8vIFByb2Nlc3NlZCBmcmFnbWVudHMgYXJlIHJlbW92ZWQgZnJvbSB0aGlzIGFycmF5LCBieSBjYWxsaW5nIGBzaGlmdE5leHRMaW5lYC5cbiAgICAgIHZhciByZW1haW5pbmdMaW5lcyA9IGFHZW5lcmF0ZWRDb2RlLnNwbGl0KFJFR0VYX05FV0xJTkUpO1xuICAgICAgdmFyIHNoaWZ0TmV4dExpbmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGxpbmVDb250ZW50cyA9IHJlbWFpbmluZ0xpbmVzLnNoaWZ0KCk7XG4gICAgICAgIC8vIFRoZSBsYXN0IGxpbmUgb2YgYSBmaWxlIG1pZ2h0IG5vdCBoYXZlIGEgbmV3bGluZS5cbiAgICAgICAgdmFyIG5ld0xpbmUgPSByZW1haW5pbmdMaW5lcy5zaGlmdCgpIHx8IFwiXCI7XG4gICAgICAgIHJldHVybiBsaW5lQ29udGVudHMgKyBuZXdMaW5lO1xuICAgICAgfTtcblxuICAgICAgLy8gV2UgbmVlZCB0byByZW1lbWJlciB0aGUgcG9zaXRpb24gb2YgXCJyZW1haW5pbmdMaW5lc1wiXG4gICAgICB2YXIgbGFzdEdlbmVyYXRlZExpbmUgPSAxLCBsYXN0R2VuZXJhdGVkQ29sdW1uID0gMDtcblxuICAgICAgLy8gVGhlIGdlbmVyYXRlIFNvdXJjZU5vZGVzIHdlIG5lZWQgYSBjb2RlIHJhbmdlLlxuICAgICAgLy8gVG8gZXh0cmFjdCBpdCBjdXJyZW50IGFuZCBsYXN0IG1hcHBpbmcgaXMgdXNlZC5cbiAgICAgIC8vIEhlcmUgd2Ugc3RvcmUgdGhlIGxhc3QgbWFwcGluZy5cbiAgICAgIHZhciBsYXN0TWFwcGluZyA9IG51bGw7XG5cbiAgICAgIGFTb3VyY2VNYXBDb25zdW1lci5lYWNoTWFwcGluZyhmdW5jdGlvbiAobWFwcGluZykge1xuICAgICAgICBpZiAobGFzdE1hcHBpbmcgIT09IG51bGwpIHtcbiAgICAgICAgICAvLyBXZSBhZGQgdGhlIGNvZGUgZnJvbSBcImxhc3RNYXBwaW5nXCIgdG8gXCJtYXBwaW5nXCI6XG4gICAgICAgICAgLy8gRmlyc3QgY2hlY2sgaWYgdGhlcmUgaXMgYSBuZXcgbGluZSBpbiBiZXR3ZWVuLlxuICAgICAgICAgIGlmIChsYXN0R2VuZXJhdGVkTGluZSA8IG1hcHBpbmcuZ2VuZXJhdGVkTGluZSkge1xuICAgICAgICAgICAgdmFyIGNvZGUgPSBcIlwiO1xuICAgICAgICAgICAgLy8gQXNzb2NpYXRlIGZpcnN0IGxpbmUgd2l0aCBcImxhc3RNYXBwaW5nXCJcbiAgICAgICAgICAgIGFkZE1hcHBpbmdXaXRoQ29kZShsYXN0TWFwcGluZywgc2hpZnROZXh0TGluZSgpKTtcbiAgICAgICAgICAgIGxhc3RHZW5lcmF0ZWRMaW5lKys7XG4gICAgICAgICAgICBsYXN0R2VuZXJhdGVkQ29sdW1uID0gMDtcbiAgICAgICAgICAgIC8vIFRoZSByZW1haW5pbmcgY29kZSBpcyBhZGRlZCB3aXRob3V0IG1hcHBpbmdcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhlcmUgaXMgbm8gbmV3IGxpbmUgaW4gYmV0d2Vlbi5cbiAgICAgICAgICAgIC8vIEFzc29jaWF0ZSB0aGUgY29kZSBiZXR3ZWVuIFwibGFzdEdlbmVyYXRlZENvbHVtblwiIGFuZFxuICAgICAgICAgICAgLy8gXCJtYXBwaW5nLmdlbmVyYXRlZENvbHVtblwiIHdpdGggXCJsYXN0TWFwcGluZ1wiXG4gICAgICAgICAgICB2YXIgbmV4dExpbmUgPSByZW1haW5pbmdMaW5lc1swXTtcbiAgICAgICAgICAgIHZhciBjb2RlID0gbmV4dExpbmUuc3Vic3RyKDAsIG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uIC1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RHZW5lcmF0ZWRDb2x1bW4pO1xuICAgICAgICAgICAgcmVtYWluaW5nTGluZXNbMF0gPSBuZXh0TGluZS5zdWJzdHIobWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4gLVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEdlbmVyYXRlZENvbHVtbik7XG4gICAgICAgICAgICBsYXN0R2VuZXJhdGVkQ29sdW1uID0gbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW47XG4gICAgICAgICAgICBhZGRNYXBwaW5nV2l0aENvZGUobGFzdE1hcHBpbmcsIGNvZGUpO1xuICAgICAgICAgICAgLy8gTm8gbW9yZSByZW1haW5pbmcgY29kZSwgY29udGludWVcbiAgICAgICAgICAgIGxhc3RNYXBwaW5nID0gbWFwcGluZztcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2UgYWRkIHRoZSBnZW5lcmF0ZWQgY29kZSB1bnRpbCB0aGUgZmlyc3QgbWFwcGluZ1xuICAgICAgICAvLyB0byB0aGUgU291cmNlTm9kZSB3aXRob3V0IGFueSBtYXBwaW5nLlxuICAgICAgICAvLyBFYWNoIGxpbmUgaXMgYWRkZWQgYXMgc2VwYXJhdGUgc3RyaW5nLlxuICAgICAgICB3aGlsZSAobGFzdEdlbmVyYXRlZExpbmUgPCBtYXBwaW5nLmdlbmVyYXRlZExpbmUpIHtcbiAgICAgICAgICBub2RlLmFkZChzaGlmdE5leHRMaW5lKCkpO1xuICAgICAgICAgIGxhc3RHZW5lcmF0ZWRMaW5lKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxhc3RHZW5lcmF0ZWRDb2x1bW4gPCBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbikge1xuICAgICAgICAgIHZhciBuZXh0TGluZSA9IHJlbWFpbmluZ0xpbmVzWzBdO1xuICAgICAgICAgIG5vZGUuYWRkKG5leHRMaW5lLnN1YnN0cigwLCBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbikpO1xuICAgICAgICAgIHJlbWFpbmluZ0xpbmVzWzBdID0gbmV4dExpbmUuc3Vic3RyKG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uKTtcbiAgICAgICAgICBsYXN0R2VuZXJhdGVkQ29sdW1uID0gbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW47XG4gICAgICAgIH1cbiAgICAgICAgbGFzdE1hcHBpbmcgPSBtYXBwaW5nO1xuICAgICAgfSwgdGhpcyk7XG4gICAgICAvLyBXZSBoYXZlIHByb2Nlc3NlZCBhbGwgbWFwcGluZ3MuXG4gICAgICBpZiAocmVtYWluaW5nTGluZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBpZiAobGFzdE1hcHBpbmcpIHtcbiAgICAgICAgICAvLyBBc3NvY2lhdGUgdGhlIHJlbWFpbmluZyBjb2RlIGluIHRoZSBjdXJyZW50IGxpbmUgd2l0aCBcImxhc3RNYXBwaW5nXCJcbiAgICAgICAgICBhZGRNYXBwaW5nV2l0aENvZGUobGFzdE1hcHBpbmcsIHNoaWZ0TmV4dExpbmUoKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYW5kIGFkZCB0aGUgcmVtYWluaW5nIGxpbmVzIHdpdGhvdXQgYW55IG1hcHBpbmdcbiAgICAgICAgbm9kZS5hZGQocmVtYWluaW5nTGluZXMuam9pbihcIlwiKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENvcHkgc291cmNlc0NvbnRlbnQgaW50byBTb3VyY2VOb2RlXG4gICAgICBhU291cmNlTWFwQ29uc3VtZXIuc291cmNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzb3VyY2VGaWxlKSB7XG4gICAgICAgIHZhciBjb250ZW50ID0gYVNvdXJjZU1hcENvbnN1bWVyLnNvdXJjZUNvbnRlbnRGb3Ioc291cmNlRmlsZSk7XG4gICAgICAgIGlmIChjb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoYVJlbGF0aXZlUGF0aCAhPSBudWxsKSB7XG4gICAgICAgICAgICBzb3VyY2VGaWxlID0gdXRpbC5qb2luKGFSZWxhdGl2ZVBhdGgsIHNvdXJjZUZpbGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBub2RlLnNldFNvdXJjZUNvbnRlbnQoc291cmNlRmlsZSwgY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gbm9kZTtcblxuICAgICAgZnVuY3Rpb24gYWRkTWFwcGluZ1dpdGhDb2RlKG1hcHBpbmcsIGNvZGUpIHtcbiAgICAgICAgaWYgKG1hcHBpbmcgPT09IG51bGwgfHwgbWFwcGluZy5zb3VyY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIG5vZGUuYWRkKGNvZGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBzb3VyY2UgPSBhUmVsYXRpdmVQYXRoXG4gICAgICAgICAgICA/IHV0aWwuam9pbihhUmVsYXRpdmVQYXRoLCBtYXBwaW5nLnNvdXJjZSlcbiAgICAgICAgICAgIDogbWFwcGluZy5zb3VyY2U7XG4gICAgICAgICAgbm9kZS5hZGQobmV3IFNvdXJjZU5vZGUobWFwcGluZy5vcmlnaW5hbExpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5vcmlnaW5hbENvbHVtbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLm5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgLyoqXG4gICAqIEFkZCBhIGNodW5rIG9mIGdlbmVyYXRlZCBKUyB0byB0aGlzIHNvdXJjZSBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0gYUNodW5rIEEgc3RyaW5nIHNuaXBwZXQgb2YgZ2VuZXJhdGVkIEpTIGNvZGUsIGFub3RoZXIgaW5zdGFuY2Ugb2ZcbiAgICogICAgICAgIFNvdXJjZU5vZGUsIG9yIGFuIGFycmF5IHdoZXJlIGVhY2ggbWVtYmVyIGlzIG9uZSBvZiB0aG9zZSB0aGluZ3MuXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiBTb3VyY2VOb2RlX2FkZChhQ2h1bmspIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShhQ2h1bmspKSB7XG4gICAgICBhQ2h1bmsuZm9yRWFjaChmdW5jdGlvbiAoY2h1bmspIHtcbiAgICAgICAgdGhpcy5hZGQoY2h1bmspO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGFDaHVua1tpc1NvdXJjZU5vZGVdIHx8IHR5cGVvZiBhQ2h1bmsgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGlmIChhQ2h1bmspIHtcbiAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKGFDaHVuayk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgXCJFeHBlY3RlZCBhIFNvdXJjZU5vZGUsIHN0cmluZywgb3IgYW4gYXJyYXkgb2YgU291cmNlTm9kZXMgYW5kIHN0cmluZ3MuIEdvdCBcIiArIGFDaHVua1xuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBhIGNodW5rIG9mIGdlbmVyYXRlZCBKUyB0byB0aGUgYmVnaW5uaW5nIG9mIHRoaXMgc291cmNlIG5vZGUuXG4gICAqXG4gICAqIEBwYXJhbSBhQ2h1bmsgQSBzdHJpbmcgc25pcHBldCBvZiBnZW5lcmF0ZWQgSlMgY29kZSwgYW5vdGhlciBpbnN0YW5jZSBvZlxuICAgKiAgICAgICAgU291cmNlTm9kZSwgb3IgYW4gYXJyYXkgd2hlcmUgZWFjaCBtZW1iZXIgaXMgb25lIG9mIHRob3NlIHRoaW5ncy5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLnByZXBlbmQgPSBmdW5jdGlvbiBTb3VyY2VOb2RlX3ByZXBlbmQoYUNodW5rKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYUNodW5rKSkge1xuICAgICAgZm9yICh2YXIgaSA9IGFDaHVuay5sZW5ndGgtMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgdGhpcy5wcmVwZW5kKGFDaHVua1tpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKGFDaHVua1tpc1NvdXJjZU5vZGVdIHx8IHR5cGVvZiBhQ2h1bmsgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHRoaXMuY2hpbGRyZW4udW5zaGlmdChhQ2h1bmspO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIFwiRXhwZWN0ZWQgYSBTb3VyY2VOb2RlLCBzdHJpbmcsIG9yIGFuIGFycmF5IG9mIFNvdXJjZU5vZGVzIGFuZCBzdHJpbmdzLiBHb3QgXCIgKyBhQ2h1bmtcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBXYWxrIG92ZXIgdGhlIHRyZWUgb2YgSlMgc25pcHBldHMgaW4gdGhpcyBub2RlIGFuZCBpdHMgY2hpbGRyZW4uIFRoZVxuICAgKiB3YWxraW5nIGZ1bmN0aW9uIGlzIGNhbGxlZCBvbmNlIGZvciBlYWNoIHNuaXBwZXQgb2YgSlMgYW5kIGlzIHBhc3NlZCB0aGF0XG4gICAqIHNuaXBwZXQgYW5kIHRoZSBpdHMgb3JpZ2luYWwgYXNzb2NpYXRlZCBzb3VyY2UncyBsaW5lL2NvbHVtbiBsb2NhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGFGbiBUaGUgdHJhdmVyc2FsIGZ1bmN0aW9uLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUud2FsayA9IGZ1bmN0aW9uIFNvdXJjZU5vZGVfd2FsayhhRm4pIHtcbiAgICB2YXIgY2h1bms7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNodW5rID0gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgIGlmIChjaHVua1tpc1NvdXJjZU5vZGVdKSB7XG4gICAgICAgIGNodW5rLndhbGsoYUZuKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBpZiAoY2h1bmsgIT09ICcnKSB7XG4gICAgICAgICAgYUZuKGNodW5rLCB7IHNvdXJjZTogdGhpcy5zb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgICAgIGxpbmU6IHRoaXMubGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiB0aGlzLmNvbHVtbixcbiAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdGhpcy5uYW1lIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBMaWtlIGBTdHJpbmcucHJvdG90eXBlLmpvaW5gIGV4Y2VwdCBmb3IgU291cmNlTm9kZXMuIEluc2VydHMgYGFTdHJgIGJldHdlZW5cbiAgICogZWFjaCBvZiBgdGhpcy5jaGlsZHJlbmAuXG4gICAqXG4gICAqIEBwYXJhbSBhU2VwIFRoZSBzZXBhcmF0b3IuXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS5qb2luID0gZnVuY3Rpb24gU291cmNlTm9kZV9qb2luKGFTZXApIHtcbiAgICB2YXIgbmV3Q2hpbGRyZW47XG4gICAgdmFyIGk7XG4gICAgdmFyIGxlbiA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGlmIChsZW4gPiAwKSB7XG4gICAgICBuZXdDaGlsZHJlbiA9IFtdO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbi0xOyBpKyspIHtcbiAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaCh0aGlzLmNoaWxkcmVuW2ldKTtcbiAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChhU2VwKTtcbiAgICAgIH1cbiAgICAgIG5ld0NoaWxkcmVuLnB1c2godGhpcy5jaGlsZHJlbltpXSk7XG4gICAgICB0aGlzLmNoaWxkcmVuID0gbmV3Q2hpbGRyZW47XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDYWxsIFN0cmluZy5wcm90b3R5cGUucmVwbGFjZSBvbiB0aGUgdmVyeSByaWdodC1tb3N0IHNvdXJjZSBzbmlwcGV0LiBVc2VmdWxcbiAgICogZm9yIHRyaW1taW5nIHdoaXRlc3BhY2UgZnJvbSB0aGUgZW5kIG9mIGEgc291cmNlIG5vZGUsIGV0Yy5cbiAgICpcbiAgICogQHBhcmFtIGFQYXR0ZXJuIFRoZSBwYXR0ZXJuIHRvIHJlcGxhY2UuXG4gICAqIEBwYXJhbSBhUmVwbGFjZW1lbnQgVGhlIHRoaW5nIHRvIHJlcGxhY2UgdGhlIHBhdHRlcm4gd2l0aC5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLnJlcGxhY2VSaWdodCA9IGZ1bmN0aW9uIFNvdXJjZU5vZGVfcmVwbGFjZVJpZ2h0KGFQYXR0ZXJuLCBhUmVwbGFjZW1lbnQpIHtcbiAgICB2YXIgbGFzdENoaWxkID0gdGhpcy5jaGlsZHJlblt0aGlzLmNoaWxkcmVuLmxlbmd0aCAtIDFdO1xuICAgIGlmIChsYXN0Q2hpbGRbaXNTb3VyY2VOb2RlXSkge1xuICAgICAgbGFzdENoaWxkLnJlcGxhY2VSaWdodChhUGF0dGVybiwgYVJlcGxhY2VtZW50KTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIGxhc3RDaGlsZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuY2hpbGRyZW5bdGhpcy5jaGlsZHJlbi5sZW5ndGggLSAxXSA9IGxhc3RDaGlsZC5yZXBsYWNlKGFQYXR0ZXJuLCBhUmVwbGFjZW1lbnQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaCgnJy5yZXBsYWNlKGFQYXR0ZXJuLCBhUmVwbGFjZW1lbnQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgc291cmNlIGNvbnRlbnQgZm9yIGEgc291cmNlIGZpbGUuIFRoaXMgd2lsbCBiZSBhZGRlZCB0byB0aGUgU291cmNlTWFwR2VuZXJhdG9yXG4gICAqIGluIHRoZSBzb3VyY2VzQ29udGVudCBmaWVsZC5cbiAgICpcbiAgICogQHBhcmFtIGFTb3VyY2VGaWxlIFRoZSBmaWxlbmFtZSBvZiB0aGUgc291cmNlIGZpbGVcbiAgICogQHBhcmFtIGFTb3VyY2VDb250ZW50IFRoZSBjb250ZW50IG9mIHRoZSBzb3VyY2UgZmlsZVxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUuc2V0U291cmNlQ29udGVudCA9XG4gICAgZnVuY3Rpb24gU291cmNlTm9kZV9zZXRTb3VyY2VDb250ZW50KGFTb3VyY2VGaWxlLCBhU291cmNlQ29udGVudCkge1xuICAgICAgdGhpcy5zb3VyY2VDb250ZW50c1t1dGlsLnRvU2V0U3RyaW5nKGFTb3VyY2VGaWxlKV0gPSBhU291cmNlQ29udGVudDtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBXYWxrIG92ZXIgdGhlIHRyZWUgb2YgU291cmNlTm9kZXMuIFRoZSB3YWxraW5nIGZ1bmN0aW9uIGlzIGNhbGxlZCBmb3IgZWFjaFxuICAgKiBzb3VyY2UgZmlsZSBjb250ZW50IGFuZCBpcyBwYXNzZWQgdGhlIGZpbGVuYW1lIGFuZCBzb3VyY2UgY29udGVudC5cbiAgICpcbiAgICogQHBhcmFtIGFGbiBUaGUgdHJhdmVyc2FsIGZ1bmN0aW9uLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUud2Fsa1NvdXJjZUNvbnRlbnRzID1cbiAgICBmdW5jdGlvbiBTb3VyY2VOb2RlX3dhbGtTb3VyY2VDb250ZW50cyhhRm4pIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGlmICh0aGlzLmNoaWxkcmVuW2ldW2lzU291cmNlTm9kZV0pIHtcbiAgICAgICAgICB0aGlzLmNoaWxkcmVuW2ldLndhbGtTb3VyY2VDb250ZW50cyhhRm4pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBzb3VyY2VzID0gT2JqZWN0LmtleXModGhpcy5zb3VyY2VDb250ZW50cyk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gc291cmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBhRm4odXRpbC5mcm9tU2V0U3RyaW5nKHNvdXJjZXNbaV0pLCB0aGlzLnNvdXJjZUNvbnRlbnRzW3NvdXJjZXNbaV1dKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHNvdXJjZSBub2RlLiBXYWxrcyBvdmVyIHRoZSB0cmVlXG4gICAqIGFuZCBjb25jYXRlbmF0ZXMgYWxsIHRoZSB2YXJpb3VzIHNuaXBwZXRzIHRvZ2V0aGVyIHRvIG9uZSBzdHJpbmcuXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIFNvdXJjZU5vZGVfdG9TdHJpbmcoKSB7XG4gICAgdmFyIHN0ciA9IFwiXCI7XG4gICAgdGhpcy53YWxrKGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgc3RyICs9IGNodW5rO1xuICAgIH0pO1xuICAgIHJldHVybiBzdHI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHNvdXJjZSBub2RlIGFsb25nIHdpdGggYSBzb3VyY2VcbiAgICogbWFwLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUudG9TdHJpbmdXaXRoU291cmNlTWFwID0gZnVuY3Rpb24gU291cmNlTm9kZV90b1N0cmluZ1dpdGhTb3VyY2VNYXAoYUFyZ3MpIHtcbiAgICB2YXIgZ2VuZXJhdGVkID0ge1xuICAgICAgY29kZTogXCJcIixcbiAgICAgIGxpbmU6IDEsXG4gICAgICBjb2x1bW46IDBcbiAgICB9O1xuICAgIHZhciBtYXAgPSBuZXcgU291cmNlTWFwR2VuZXJhdG9yKGFBcmdzKTtcbiAgICB2YXIgc291cmNlTWFwcGluZ0FjdGl2ZSA9IGZhbHNlO1xuICAgIHZhciBsYXN0T3JpZ2luYWxTb3VyY2UgPSBudWxsO1xuICAgIHZhciBsYXN0T3JpZ2luYWxMaW5lID0gbnVsbDtcbiAgICB2YXIgbGFzdE9yaWdpbmFsQ29sdW1uID0gbnVsbDtcbiAgICB2YXIgbGFzdE9yaWdpbmFsTmFtZSA9IG51bGw7XG4gICAgdGhpcy53YWxrKGZ1bmN0aW9uIChjaHVuaywgb3JpZ2luYWwpIHtcbiAgICAgIGdlbmVyYXRlZC5jb2RlICs9IGNodW5rO1xuICAgICAgaWYgKG9yaWdpbmFsLnNvdXJjZSAhPT0gbnVsbFxuICAgICAgICAgICYmIG9yaWdpbmFsLmxpbmUgIT09IG51bGxcbiAgICAgICAgICAmJiBvcmlnaW5hbC5jb2x1bW4gIT09IG51bGwpIHtcbiAgICAgICAgaWYobGFzdE9yaWdpbmFsU291cmNlICE9PSBvcmlnaW5hbC5zb3VyY2VcbiAgICAgICAgICAgfHwgbGFzdE9yaWdpbmFsTGluZSAhPT0gb3JpZ2luYWwubGluZVxuICAgICAgICAgICB8fCBsYXN0T3JpZ2luYWxDb2x1bW4gIT09IG9yaWdpbmFsLmNvbHVtblxuICAgICAgICAgICB8fCBsYXN0T3JpZ2luYWxOYW1lICE9PSBvcmlnaW5hbC5uYW1lKSB7XG4gICAgICAgICAgbWFwLmFkZE1hcHBpbmcoe1xuICAgICAgICAgICAgc291cmNlOiBvcmlnaW5hbC5zb3VyY2UsXG4gICAgICAgICAgICBvcmlnaW5hbDoge1xuICAgICAgICAgICAgICBsaW5lOiBvcmlnaW5hbC5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IG9yaWdpbmFsLmNvbHVtblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdlbmVyYXRlZDoge1xuICAgICAgICAgICAgICBsaW5lOiBnZW5lcmF0ZWQubGluZSxcbiAgICAgICAgICAgICAgY29sdW1uOiBnZW5lcmF0ZWQuY29sdW1uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmFtZTogb3JpZ2luYWwubmFtZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGxhc3RPcmlnaW5hbFNvdXJjZSA9IG9yaWdpbmFsLnNvdXJjZTtcbiAgICAgICAgbGFzdE9yaWdpbmFsTGluZSA9IG9yaWdpbmFsLmxpbmU7XG4gICAgICAgIGxhc3RPcmlnaW5hbENvbHVtbiA9IG9yaWdpbmFsLmNvbHVtbjtcbiAgICAgICAgbGFzdE9yaWdpbmFsTmFtZSA9IG9yaWdpbmFsLm5hbWU7XG4gICAgICAgIHNvdXJjZU1hcHBpbmdBY3RpdmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChzb3VyY2VNYXBwaW5nQWN0aXZlKSB7XG4gICAgICAgIG1hcC5hZGRNYXBwaW5nKHtcbiAgICAgICAgICBnZW5lcmF0ZWQ6IHtcbiAgICAgICAgICAgIGxpbmU6IGdlbmVyYXRlZC5saW5lLFxuICAgICAgICAgICAgY29sdW1uOiBnZW5lcmF0ZWQuY29sdW1uXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgbGFzdE9yaWdpbmFsU291cmNlID0gbnVsbDtcbiAgICAgICAgc291cmNlTWFwcGluZ0FjdGl2ZSA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgaWR4ID0gMCwgbGVuZ3RoID0gY2h1bmsubGVuZ3RoOyBpZHggPCBsZW5ndGg7IGlkeCsrKSB7XG4gICAgICAgIGlmIChjaHVuay5jaGFyQ29kZUF0KGlkeCkgPT09IE5FV0xJTkVfQ09ERSkge1xuICAgICAgICAgIGdlbmVyYXRlZC5saW5lKys7XG4gICAgICAgICAgZ2VuZXJhdGVkLmNvbHVtbiA9IDA7XG4gICAgICAgICAgLy8gTWFwcGluZ3MgZW5kIGF0IGVvbFxuICAgICAgICAgIGlmIChpZHggKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAgIGxhc3RPcmlnaW5hbFNvdXJjZSA9IG51bGw7XG4gICAgICAgICAgICBzb3VyY2VNYXBwaW5nQWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VNYXBwaW5nQWN0aXZlKSB7XG4gICAgICAgICAgICBtYXAuYWRkTWFwcGluZyh7XG4gICAgICAgICAgICAgIHNvdXJjZTogb3JpZ2luYWwuc291cmNlLFxuICAgICAgICAgICAgICBvcmlnaW5hbDoge1xuICAgICAgICAgICAgICAgIGxpbmU6IG9yaWdpbmFsLmxpbmUsXG4gICAgICAgICAgICAgICAgY29sdW1uOiBvcmlnaW5hbC5jb2x1bW5cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgZ2VuZXJhdGVkOiB7XG4gICAgICAgICAgICAgICAgbGluZTogZ2VuZXJhdGVkLmxpbmUsXG4gICAgICAgICAgICAgICAgY29sdW1uOiBnZW5lcmF0ZWQuY29sdW1uXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIG5hbWU6IG9yaWdpbmFsLm5hbWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBnZW5lcmF0ZWQuY29sdW1uKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLndhbGtTb3VyY2VDb250ZW50cyhmdW5jdGlvbiAoc291cmNlRmlsZSwgc291cmNlQ29udGVudCkge1xuICAgICAgbWFwLnNldFNvdXJjZUNvbnRlbnQoc291cmNlRmlsZSwgc291cmNlQ29udGVudCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyBjb2RlOiBnZW5lcmF0ZWQuY29kZSwgbWFwOiBtYXAgfTtcbiAgfTtcblxuICBleHBvcnRzLlNvdXJjZU5vZGUgPSBTb3VyY2VOb2RlO1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBoZWxwZXIgZnVuY3Rpb24gZm9yIGdldHRpbmcgdmFsdWVzIGZyb20gcGFyYW1ldGVyL29wdGlvbnNcbiAgICogb2JqZWN0cy5cbiAgICpcbiAgICogQHBhcmFtIGFyZ3MgVGhlIG9iamVjdCB3ZSBhcmUgZXh0cmFjdGluZyB2YWx1ZXMgZnJvbVxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgd2UgYXJlIGdldHRpbmcuXG4gICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUgQW4gb3B0aW9uYWwgdmFsdWUgdG8gcmV0dXJuIGlmIHRoZSBwcm9wZXJ0eSBpcyBtaXNzaW5nXG4gICAqIGZyb20gdGhlIG9iamVjdC4gSWYgdGhpcyBpcyBub3Qgc3BlY2lmaWVkIGFuZCB0aGUgcHJvcGVydHkgaXMgbWlzc2luZywgYW5cbiAgICogZXJyb3Igd2lsbCBiZSB0aHJvd24uXG4gICAqL1xuICBmdW5jdGlvbiBnZXRBcmcoYUFyZ3MsIGFOYW1lLCBhRGVmYXVsdFZhbHVlKSB7XG4gICAgaWYgKGFOYW1lIGluIGFBcmdzKSB7XG4gICAgICByZXR1cm4gYUFyZ3NbYU5hbWVdO1xuICAgIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgcmV0dXJuIGFEZWZhdWx0VmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignXCInICsgYU5hbWUgKyAnXCIgaXMgYSByZXF1aXJlZCBhcmd1bWVudC4nKTtcbiAgICB9XG4gIH1cbiAgZXhwb3J0cy5nZXRBcmcgPSBnZXRBcmc7XG5cbiAgdmFyIHVybFJlZ2V4cCA9IC9eKD86KFtcXHcrXFwtLl0rKTopP1xcL1xcLyg/OihcXHcrOlxcdyspQCk/KFtcXHcuXSopKD86OihcXGQrKSk/KFxcUyopJC87XG4gIHZhciBkYXRhVXJsUmVnZXhwID0gL15kYXRhOi4rXFwsLiskLztcblxuICBmdW5jdGlvbiB1cmxQYXJzZShhVXJsKSB7XG4gICAgdmFyIG1hdGNoID0gYVVybC5tYXRjaCh1cmxSZWdleHApO1xuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgc2NoZW1lOiBtYXRjaFsxXSxcbiAgICAgIGF1dGg6IG1hdGNoWzJdLFxuICAgICAgaG9zdDogbWF0Y2hbM10sXG4gICAgICBwb3J0OiBtYXRjaFs0XSxcbiAgICAgIHBhdGg6IG1hdGNoWzVdXG4gICAgfTtcbiAgfVxuICBleHBvcnRzLnVybFBhcnNlID0gdXJsUGFyc2U7XG5cbiAgZnVuY3Rpb24gdXJsR2VuZXJhdGUoYVBhcnNlZFVybCkge1xuICAgIHZhciB1cmwgPSAnJztcbiAgICBpZiAoYVBhcnNlZFVybC5zY2hlbWUpIHtcbiAgICAgIHVybCArPSBhUGFyc2VkVXJsLnNjaGVtZSArICc6JztcbiAgICB9XG4gICAgdXJsICs9ICcvLyc7XG4gICAgaWYgKGFQYXJzZWRVcmwuYXV0aCkge1xuICAgICAgdXJsICs9IGFQYXJzZWRVcmwuYXV0aCArICdAJztcbiAgICB9XG4gICAgaWYgKGFQYXJzZWRVcmwuaG9zdCkge1xuICAgICAgdXJsICs9IGFQYXJzZWRVcmwuaG9zdDtcbiAgICB9XG4gICAgaWYgKGFQYXJzZWRVcmwucG9ydCkge1xuICAgICAgdXJsICs9IFwiOlwiICsgYVBhcnNlZFVybC5wb3J0XG4gICAgfVxuICAgIGlmIChhUGFyc2VkVXJsLnBhdGgpIHtcbiAgICAgIHVybCArPSBhUGFyc2VkVXJsLnBhdGg7XG4gICAgfVxuICAgIHJldHVybiB1cmw7XG4gIH1cbiAgZXhwb3J0cy51cmxHZW5lcmF0ZSA9IHVybEdlbmVyYXRlO1xuXG4gIC8qKlxuICAgKiBOb3JtYWxpemVzIGEgcGF0aCwgb3IgdGhlIHBhdGggcG9ydGlvbiBvZiBhIFVSTDpcbiAgICpcbiAgICogLSBSZXBsYWNlcyBjb25zZXF1dGl2ZSBzbGFzaGVzIHdpdGggb25lIHNsYXNoLlxuICAgKiAtIFJlbW92ZXMgdW5uZWNlc3NhcnkgJy4nIHBhcnRzLlxuICAgKiAtIFJlbW92ZXMgdW5uZWNlc3NhcnkgJzxkaXI+Ly4uJyBwYXJ0cy5cbiAgICpcbiAgICogQmFzZWQgb24gY29kZSBpbiB0aGUgTm9kZS5qcyAncGF0aCcgY29yZSBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSBhUGF0aCBUaGUgcGF0aCBvciB1cmwgdG8gbm9ybWFsaXplLlxuICAgKi9cbiAgZnVuY3Rpb24gbm9ybWFsaXplKGFQYXRoKSB7XG4gICAgdmFyIHBhdGggPSBhUGF0aDtcbiAgICB2YXIgdXJsID0gdXJsUGFyc2UoYVBhdGgpO1xuICAgIGlmICh1cmwpIHtcbiAgICAgIGlmICghdXJsLnBhdGgpIHtcbiAgICAgICAgcmV0dXJuIGFQYXRoO1xuICAgICAgfVxuICAgICAgcGF0aCA9IHVybC5wYXRoO1xuICAgIH1cbiAgICB2YXIgaXNBYnNvbHV0ZSA9IChwYXRoLmNoYXJBdCgwKSA9PT0gJy8nKTtcblxuICAgIHZhciBwYXJ0cyA9IHBhdGguc3BsaXQoL1xcLysvKTtcbiAgICBmb3IgKHZhciBwYXJ0LCB1cCA9IDAsIGkgPSBwYXJ0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgaWYgKHBhcnQgPT09ICcuJykge1xuICAgICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB9IGVsc2UgaWYgKHBhcnQgPT09ICcuLicpIHtcbiAgICAgICAgdXArKztcbiAgICAgIH0gZWxzZSBpZiAodXAgPiAwKSB7XG4gICAgICAgIGlmIChwYXJ0ID09PSAnJykge1xuICAgICAgICAgIC8vIFRoZSBmaXJzdCBwYXJ0IGlzIGJsYW5rIGlmIHRoZSBwYXRoIGlzIGFic29sdXRlLiBUcnlpbmcgdG8gZ29cbiAgICAgICAgICAvLyBhYm92ZSB0aGUgcm9vdCBpcyBhIG5vLW9wLiBUaGVyZWZvcmUgd2UgY2FuIHJlbW92ZSBhbGwgJy4uJyBwYXJ0c1xuICAgICAgICAgIC8vIGRpcmVjdGx5IGFmdGVyIHRoZSByb290LlxuICAgICAgICAgIHBhcnRzLnNwbGljZShpICsgMSwgdXApO1xuICAgICAgICAgIHVwID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwYXJ0cy5zcGxpY2UoaSwgMik7XG4gICAgICAgICAgdXAtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBwYXRoID0gcGFydHMuam9pbignLycpO1xuXG4gICAgaWYgKHBhdGggPT09ICcnKSB7XG4gICAgICBwYXRoID0gaXNBYnNvbHV0ZSA/ICcvJyA6ICcuJztcbiAgICB9XG5cbiAgICBpZiAodXJsKSB7XG4gICAgICB1cmwucGF0aCA9IHBhdGg7XG4gICAgICByZXR1cm4gdXJsR2VuZXJhdGUodXJsKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhdGg7XG4gIH1cbiAgZXhwb3J0cy5ub3JtYWxpemUgPSBub3JtYWxpemU7XG5cbiAgLyoqXG4gICAqIEpvaW5zIHR3byBwYXRocy9VUkxzLlxuICAgKlxuICAgKiBAcGFyYW0gYVJvb3QgVGhlIHJvb3QgcGF0aCBvciBVUkwuXG4gICAqIEBwYXJhbSBhUGF0aCBUaGUgcGF0aCBvciBVUkwgdG8gYmUgam9pbmVkIHdpdGggdGhlIHJvb3QuXG4gICAqXG4gICAqIC0gSWYgYVBhdGggaXMgYSBVUkwgb3IgYSBkYXRhIFVSSSwgYVBhdGggaXMgcmV0dXJuZWQsIHVubGVzcyBhUGF0aCBpcyBhXG4gICAqICAgc2NoZW1lLXJlbGF0aXZlIFVSTDogVGhlbiB0aGUgc2NoZW1lIG9mIGFSb290LCBpZiBhbnksIGlzIHByZXBlbmRlZFxuICAgKiAgIGZpcnN0LlxuICAgKiAtIE90aGVyd2lzZSBhUGF0aCBpcyBhIHBhdGguIElmIGFSb290IGlzIGEgVVJMLCB0aGVuIGl0cyBwYXRoIHBvcnRpb25cbiAgICogICBpcyB1cGRhdGVkIHdpdGggdGhlIHJlc3VsdCBhbmQgYVJvb3QgaXMgcmV0dXJuZWQuIE90aGVyd2lzZSB0aGUgcmVzdWx0XG4gICAqICAgaXMgcmV0dXJuZWQuXG4gICAqICAgLSBJZiBhUGF0aCBpcyBhYnNvbHV0ZSwgdGhlIHJlc3VsdCBpcyBhUGF0aC5cbiAgICogICAtIE90aGVyd2lzZSB0aGUgdHdvIHBhdGhzIGFyZSBqb2luZWQgd2l0aCBhIHNsYXNoLlxuICAgKiAtIEpvaW5pbmcgZm9yIGV4YW1wbGUgJ2h0dHA6Ly8nIGFuZCAnd3d3LmV4YW1wbGUuY29tJyBpcyBhbHNvIHN1cHBvcnRlZC5cbiAgICovXG4gIGZ1bmN0aW9uIGpvaW4oYVJvb3QsIGFQYXRoKSB7XG4gICAgaWYgKGFSb290ID09PSBcIlwiKSB7XG4gICAgICBhUm9vdCA9IFwiLlwiO1xuICAgIH1cbiAgICBpZiAoYVBhdGggPT09IFwiXCIpIHtcbiAgICAgIGFQYXRoID0gXCIuXCI7XG4gICAgfVxuICAgIHZhciBhUGF0aFVybCA9IHVybFBhcnNlKGFQYXRoKTtcbiAgICB2YXIgYVJvb3RVcmwgPSB1cmxQYXJzZShhUm9vdCk7XG4gICAgaWYgKGFSb290VXJsKSB7XG4gICAgICBhUm9vdCA9IGFSb290VXJsLnBhdGggfHwgJy8nO1xuICAgIH1cblxuICAgIC8vIGBqb2luKGZvbywgJy8vd3d3LmV4YW1wbGUub3JnJylgXG4gICAgaWYgKGFQYXRoVXJsICYmICFhUGF0aFVybC5zY2hlbWUpIHtcbiAgICAgIGlmIChhUm9vdFVybCkge1xuICAgICAgICBhUGF0aFVybC5zY2hlbWUgPSBhUm9vdFVybC5zY2hlbWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gdXJsR2VuZXJhdGUoYVBhdGhVcmwpO1xuICAgIH1cblxuICAgIGlmIChhUGF0aFVybCB8fCBhUGF0aC5tYXRjaChkYXRhVXJsUmVnZXhwKSkge1xuICAgICAgcmV0dXJuIGFQYXRoO1xuICAgIH1cblxuICAgIC8vIGBqb2luKCdodHRwOi8vJywgJ3d3dy5leGFtcGxlLmNvbScpYFxuICAgIGlmIChhUm9vdFVybCAmJiAhYVJvb3RVcmwuaG9zdCAmJiAhYVJvb3RVcmwucGF0aCkge1xuICAgICAgYVJvb3RVcmwuaG9zdCA9IGFQYXRoO1xuICAgICAgcmV0dXJuIHVybEdlbmVyYXRlKGFSb290VXJsKTtcbiAgICB9XG5cbiAgICB2YXIgam9pbmVkID0gYVBhdGguY2hhckF0KDApID09PSAnLydcbiAgICAgID8gYVBhdGhcbiAgICAgIDogbm9ybWFsaXplKGFSb290LnJlcGxhY2UoL1xcLyskLywgJycpICsgJy8nICsgYVBhdGgpO1xuXG4gICAgaWYgKGFSb290VXJsKSB7XG4gICAgICBhUm9vdFVybC5wYXRoID0gam9pbmVkO1xuICAgICAgcmV0dXJuIHVybEdlbmVyYXRlKGFSb290VXJsKTtcbiAgICB9XG4gICAgcmV0dXJuIGpvaW5lZDtcbiAgfVxuICBleHBvcnRzLmpvaW4gPSBqb2luO1xuXG4gIC8qKlxuICAgKiBNYWtlIGEgcGF0aCByZWxhdGl2ZSB0byBhIFVSTCBvciBhbm90aGVyIHBhdGguXG4gICAqXG4gICAqIEBwYXJhbSBhUm9vdCBUaGUgcm9vdCBwYXRoIG9yIFVSTC5cbiAgICogQHBhcmFtIGFQYXRoIFRoZSBwYXRoIG9yIFVSTCB0byBiZSBtYWRlIHJlbGF0aXZlIHRvIGFSb290LlxuICAgKi9cbiAgZnVuY3Rpb24gcmVsYXRpdmUoYVJvb3QsIGFQYXRoKSB7XG4gICAgaWYgKGFSb290ID09PSBcIlwiKSB7XG4gICAgICBhUm9vdCA9IFwiLlwiO1xuICAgIH1cblxuICAgIGFSb290ID0gYVJvb3QucmVwbGFjZSgvXFwvJC8sICcnKTtcblxuICAgIC8vIEl0IGlzIHBvc3NpYmxlIGZvciB0aGUgcGF0aCB0byBiZSBhYm92ZSB0aGUgcm9vdC4gSW4gdGhpcyBjYXNlLCBzaW1wbHlcbiAgICAvLyBjaGVja2luZyB3aGV0aGVyIHRoZSByb290IGlzIGEgcHJlZml4IG9mIHRoZSBwYXRoIHdvbid0IHdvcmsuIEluc3RlYWQsIHdlXG4gICAgLy8gbmVlZCB0byByZW1vdmUgY29tcG9uZW50cyBmcm9tIHRoZSByb290IG9uZSBieSBvbmUsIHVudGlsIGVpdGhlciB3ZSBmaW5kXG4gICAgLy8gYSBwcmVmaXggdGhhdCBmaXRzLCBvciB3ZSBydW4gb3V0IG9mIGNvbXBvbmVudHMgdG8gcmVtb3ZlLlxuICAgIHZhciBsZXZlbCA9IDA7XG4gICAgd2hpbGUgKGFQYXRoLmluZGV4T2YoYVJvb3QgKyAnLycpICE9PSAwKSB7XG4gICAgICB2YXIgaW5kZXggPSBhUm9vdC5sYXN0SW5kZXhPZihcIi9cIik7XG4gICAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICAgIHJldHVybiBhUGF0aDtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlIG9ubHkgcGFydCBvZiB0aGUgcm9vdCB0aGF0IGlzIGxlZnQgaXMgdGhlIHNjaGVtZSAoaS5lLiBodHRwOi8vLFxuICAgICAgLy8gZmlsZTovLy8sIGV0Yy4pLCBvbmUgb3IgbW9yZSBzbGFzaGVzICgvKSwgb3Igc2ltcGx5IG5vdGhpbmcgYXQgYWxsLCB3ZVxuICAgICAgLy8gaGF2ZSBleGhhdXN0ZWQgYWxsIGNvbXBvbmVudHMsIHNvIHRoZSBwYXRoIGlzIG5vdCByZWxhdGl2ZSB0byB0aGUgcm9vdC5cbiAgICAgIGFSb290ID0gYVJvb3Quc2xpY2UoMCwgaW5kZXgpO1xuICAgICAgaWYgKGFSb290Lm1hdGNoKC9eKFteXFwvXSs6XFwvKT9cXC8qJC8pKSB7XG4gICAgICAgIHJldHVybiBhUGF0aDtcbiAgICAgIH1cblxuICAgICAgKytsZXZlbDtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgd2UgYWRkIGEgXCIuLi9cIiBmb3IgZWFjaCBjb21wb25lbnQgd2UgcmVtb3ZlZCBmcm9tIHRoZSByb290LlxuICAgIHJldHVybiBBcnJheShsZXZlbCArIDEpLmpvaW4oXCIuLi9cIikgKyBhUGF0aC5zdWJzdHIoYVJvb3QubGVuZ3RoICsgMSk7XG4gIH1cbiAgZXhwb3J0cy5yZWxhdGl2ZSA9IHJlbGF0aXZlO1xuXG4gIC8qKlxuICAgKiBCZWNhdXNlIGJlaGF2aW9yIGdvZXMgd2Fja3kgd2hlbiB5b3Ugc2V0IGBfX3Byb3RvX19gIG9uIG9iamVjdHMsIHdlXG4gICAqIGhhdmUgdG8gcHJlZml4IGFsbCB0aGUgc3RyaW5ncyBpbiBvdXIgc2V0IHdpdGggYW4gYXJiaXRyYXJ5IGNoYXJhY3Rlci5cbiAgICpcbiAgICogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL3NvdXJjZS1tYXAvcHVsbC8zMSBhbmRcbiAgICogaHR0cHM6Ly9naXRodWIuY29tL21vemlsbGEvc291cmNlLW1hcC9pc3N1ZXMvMzBcbiAgICpcbiAgICogQHBhcmFtIFN0cmluZyBhU3RyXG4gICAqL1xuICBmdW5jdGlvbiB0b1NldFN0cmluZyhhU3RyKSB7XG4gICAgcmV0dXJuICckJyArIGFTdHI7XG4gIH1cbiAgZXhwb3J0cy50b1NldFN0cmluZyA9IHRvU2V0U3RyaW5nO1xuXG4gIGZ1bmN0aW9uIGZyb21TZXRTdHJpbmcoYVN0cikge1xuICAgIHJldHVybiBhU3RyLnN1YnN0cigxKTtcbiAgfVxuICBleHBvcnRzLmZyb21TZXRTdHJpbmcgPSBmcm9tU2V0U3RyaW5nO1xuXG4gIC8qKlxuICAgKiBDb21wYXJhdG9yIGJldHdlZW4gdHdvIG1hcHBpbmdzIHdoZXJlIHRoZSBvcmlnaW5hbCBwb3NpdGlvbnMgYXJlIGNvbXBhcmVkLlxuICAgKlxuICAgKiBPcHRpb25hbGx5IHBhc3MgaW4gYHRydWVgIGFzIGBvbmx5Q29tcGFyZUdlbmVyYXRlZGAgdG8gY29uc2lkZXIgdHdvXG4gICAqIG1hcHBpbmdzIHdpdGggdGhlIHNhbWUgb3JpZ2luYWwgc291cmNlL2xpbmUvY29sdW1uLCBidXQgZGlmZmVyZW50IGdlbmVyYXRlZFxuICAgKiBsaW5lIGFuZCBjb2x1bW4gdGhlIHNhbWUuIFVzZWZ1bCB3aGVuIHNlYXJjaGluZyBmb3IgYSBtYXBwaW5nIHdpdGggYVxuICAgKiBzdHViYmVkIG91dCBtYXBwaW5nLlxuICAgKi9cbiAgZnVuY3Rpb24gY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMobWFwcGluZ0EsIG1hcHBpbmdCLCBvbmx5Q29tcGFyZU9yaWdpbmFsKSB7XG4gICAgdmFyIGNtcCA9IG1hcHBpbmdBLnNvdXJjZSAtIG1hcHBpbmdCLnNvdXJjZTtcbiAgICBpZiAoY21wICE9PSAwKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIGNtcCA9IG1hcHBpbmdBLm9yaWdpbmFsTGluZSAtIG1hcHBpbmdCLm9yaWdpbmFsTGluZTtcbiAgICBpZiAoY21wICE9PSAwKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIGNtcCA9IG1hcHBpbmdBLm9yaWdpbmFsQ29sdW1uIC0gbWFwcGluZ0Iub3JpZ2luYWxDb2x1bW47XG4gICAgaWYgKGNtcCAhPT0gMCB8fCBvbmx5Q29tcGFyZU9yaWdpbmFsKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIGNtcCA9IG1hcHBpbmdBLmdlbmVyYXRlZENvbHVtbiAtIG1hcHBpbmdCLmdlbmVyYXRlZENvbHVtbjtcbiAgICBpZiAoY21wICE9PSAwKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIGNtcCA9IG1hcHBpbmdBLmdlbmVyYXRlZExpbmUgLSBtYXBwaW5nQi5nZW5lcmF0ZWRMaW5lO1xuICAgIGlmIChjbXAgIT09IDApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hcHBpbmdBLm5hbWUgLSBtYXBwaW5nQi5uYW1lO1xuICB9O1xuICBleHBvcnRzLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zID0gY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnM7XG5cbiAgLyoqXG4gICAqIENvbXBhcmF0b3IgYmV0d2VlbiB0d28gbWFwcGluZ3Mgd2l0aCBkZWZsYXRlZCBzb3VyY2UgYW5kIG5hbWUgaW5kaWNlcyB3aGVyZVxuICAgKiB0aGUgZ2VuZXJhdGVkIHBvc2l0aW9ucyBhcmUgY29tcGFyZWQuXG4gICAqXG4gICAqIE9wdGlvbmFsbHkgcGFzcyBpbiBgdHJ1ZWAgYXMgYG9ubHlDb21wYXJlR2VuZXJhdGVkYCB0byBjb25zaWRlciB0d29cbiAgICogbWFwcGluZ3Mgd2l0aCB0aGUgc2FtZSBnZW5lcmF0ZWQgbGluZSBhbmQgY29sdW1uLCBidXQgZGlmZmVyZW50XG4gICAqIHNvdXJjZS9uYW1lL29yaWdpbmFsIGxpbmUgYW5kIGNvbHVtbiB0aGUgc2FtZS4gVXNlZnVsIHdoZW4gc2VhcmNoaW5nIGZvciBhXG4gICAqIG1hcHBpbmcgd2l0aCBhIHN0dWJiZWQgb3V0IG1hcHBpbmcuXG4gICAqL1xuICBmdW5jdGlvbiBjb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNEZWZsYXRlZChtYXBwaW5nQSwgbWFwcGluZ0IsIG9ubHlDb21wYXJlR2VuZXJhdGVkKSB7XG4gICAgdmFyIGNtcCA9IG1hcHBpbmdBLmdlbmVyYXRlZExpbmUgLSBtYXBwaW5nQi5nZW5lcmF0ZWRMaW5lO1xuICAgIGlmIChjbXAgIT09IDApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0EuZ2VuZXJhdGVkQ29sdW1uIC0gbWFwcGluZ0IuZ2VuZXJhdGVkQ29sdW1uO1xuICAgIGlmIChjbXAgIT09IDAgfHwgb25seUNvbXBhcmVHZW5lcmF0ZWQpIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Euc291cmNlIC0gbWFwcGluZ0Iuc291cmNlO1xuICAgIGlmIChjbXAgIT09IDApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxMaW5lIC0gbWFwcGluZ0Iub3JpZ2luYWxMaW5lO1xuICAgIGlmIChjbXAgIT09IDApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxDb2x1bW4gLSBtYXBwaW5nQi5vcmlnaW5hbENvbHVtbjtcbiAgICBpZiAoY21wICE9PSAwKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIHJldHVybiBtYXBwaW5nQS5uYW1lIC0gbWFwcGluZ0IubmFtZTtcbiAgfTtcbiAgZXhwb3J0cy5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNEZWZsYXRlZCA9IGNvbXBhcmVCeUdlbmVyYXRlZFBvc2l0aW9uc0RlZmxhdGVkO1xuXG4gIGZ1bmN0aW9uIHN0cmNtcChhU3RyMSwgYVN0cjIpIHtcbiAgICBpZiAoYVN0cjEgPT09IGFTdHIyKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBpZiAoYVN0cjEgPiBhU3RyMikge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBhcmF0b3IgYmV0d2VlbiB0d28gbWFwcGluZ3Mgd2l0aCBpbmZsYXRlZCBzb3VyY2UgYW5kIG5hbWUgc3RyaW5ncyB3aGVyZVxuICAgKiB0aGUgZ2VuZXJhdGVkIHBvc2l0aW9ucyBhcmUgY29tcGFyZWQuXG4gICAqL1xuICBmdW5jdGlvbiBjb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNJbmZsYXRlZChtYXBwaW5nQSwgbWFwcGluZ0IpIHtcbiAgICB2YXIgY21wID0gbWFwcGluZ0EuZ2VuZXJhdGVkTGluZSAtIG1hcHBpbmdCLmdlbmVyYXRlZExpbmU7XG4gICAgaWYgKGNtcCAhPT0gMCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5nZW5lcmF0ZWRDb2x1bW4gLSBtYXBwaW5nQi5nZW5lcmF0ZWRDb2x1bW47XG4gICAgaWYgKGNtcCAhPT0gMCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBzdHJjbXAobWFwcGluZ0Euc291cmNlLCBtYXBwaW5nQi5zb3VyY2UpO1xuICAgIGlmIChjbXAgIT09IDApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxMaW5lIC0gbWFwcGluZ0Iub3JpZ2luYWxMaW5lO1xuICAgIGlmIChjbXAgIT09IDApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxDb2x1bW4gLSBtYXBwaW5nQi5vcmlnaW5hbENvbHVtbjtcbiAgICBpZiAoY21wICE9PSAwKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIHJldHVybiBzdHJjbXAobWFwcGluZ0EubmFtZSwgbWFwcGluZ0IubmFtZSk7XG4gIH07XG4gIGV4cG9ydHMuY29tcGFyZUJ5R2VuZXJhdGVkUG9zaXRpb25zSW5mbGF0ZWQgPSBjb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnNJbmZsYXRlZDtcblxufSk7XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gcmVzb2x2ZXMgLiBhbmQgLi4gZWxlbWVudHMgaW4gYSBwYXRoIGFycmF5IHdpdGggZGlyZWN0b3J5IG5hbWVzIHRoZXJlXG4vLyBtdXN0IGJlIG5vIHNsYXNoZXMsIGVtcHR5IGVsZW1lbnRzLCBvciBkZXZpY2UgbmFtZXMgKGM6XFwpIGluIHRoZSBhcnJheVxuLy8gKHNvIGFsc28gbm8gbGVhZGluZyBhbmQgdHJhaWxpbmcgc2xhc2hlcyAtIGl0IGRvZXMgbm90IGRpc3Rpbmd1aXNoXG4vLyByZWxhdGl2ZSBhbmQgYWJzb2x1dGUgcGF0aHMpXG5mdW5jdGlvbiBub3JtYWxpemVBcnJheShwYXJ0cywgYWxsb3dBYm92ZVJvb3QpIHtcbiAgLy8gaWYgdGhlIHBhdGggdHJpZXMgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIGB1cGAgZW5kcyB1cCA+IDBcbiAgdmFyIHVwID0gMDtcbiAgZm9yICh2YXIgaSA9IHBhcnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgdmFyIGxhc3QgPSBwYXJ0c1tpXTtcbiAgICBpZiAobGFzdCA9PT0gJy4nKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChsYXN0ID09PSAnLi4nKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cCsrO1xuICAgIH0gZWxzZSBpZiAodXApIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIHVwLS07XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIHBhdGggaXMgYWxsb3dlZCB0byBnbyBhYm92ZSB0aGUgcm9vdCwgcmVzdG9yZSBsZWFkaW5nIC4uc1xuICBpZiAoYWxsb3dBYm92ZVJvb3QpIHtcbiAgICBmb3IgKDsgdXAtLTsgdXApIHtcbiAgICAgIHBhcnRzLnVuc2hpZnQoJy4uJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhcnRzO1xufVxuXG4vLyBTcGxpdCBhIGZpbGVuYW1lIGludG8gW3Jvb3QsIGRpciwgYmFzZW5hbWUsIGV4dF0sIHVuaXggdmVyc2lvblxuLy8gJ3Jvb3QnIGlzIGp1c3QgYSBzbGFzaCwgb3Igbm90aGluZy5cbnZhciBzcGxpdFBhdGhSZSA9XG4gICAgL14oXFwvP3wpKFtcXHNcXFNdKj8pKCg/OlxcLnsxLDJ9fFteXFwvXSs/fCkoXFwuW14uXFwvXSp8KSkoPzpbXFwvXSopJC87XG52YXIgc3BsaXRQYXRoID0gZnVuY3Rpb24oZmlsZW5hbWUpIHtcbiAgcmV0dXJuIHNwbGl0UGF0aFJlLmV4ZWMoZmlsZW5hbWUpLnNsaWNlKDEpO1xufTtcblxuLy8gcGF0aC5yZXNvbHZlKFtmcm9tIC4uLl0sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gIHZhciByZXNvbHZlZFBhdGggPSAnJyxcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgIHZhciBwYXRoID0gKGkgPj0gMCkgPyBhcmd1bWVudHNbaV0gOiBwcm9jZXNzLmN3ZCgpO1xuXG4gICAgLy8gU2tpcCBlbXB0eSBhbmQgaW52YWxpZCBlbnRyaWVzXG4gICAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGgucmVzb2x2ZSBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9IGVsc2UgaWYgKCFwYXRoKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICByZXNvbHZlZFBhdGggPSBwYXRoICsgJy8nICsgcmVzb2x2ZWRQYXRoO1xuICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xuICB9XG5cbiAgLy8gQXQgdGhpcyBwb2ludCB0aGUgcGF0aCBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gYSBmdWxsIGFic29sdXRlIHBhdGgsIGJ1dFxuICAvLyBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKSBmYWlscylcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcmVzb2x2ZWRQYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHJlc29sdmVkUGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFyZXNvbHZlZEFic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgcmV0dXJuICgocmVzb2x2ZWRBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHJlc29sdmVkUGF0aCkgfHwgJy4nO1xufTtcblxuLy8gcGF0aC5ub3JtYWxpemUocGF0aClcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMubm9ybWFsaXplID0gZnVuY3Rpb24ocGF0aCkge1xuICB2YXIgaXNBYnNvbHV0ZSA9IGV4cG9ydHMuaXNBYnNvbHV0ZShwYXRoKSxcbiAgICAgIHRyYWlsaW5nU2xhc2ggPSBzdWJzdHIocGF0aCwgLTEpID09PSAnLyc7XG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFpc0Fic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgaWYgKCFwYXRoICYmICFpc0Fic29sdXRlKSB7XG4gICAgcGF0aCA9ICcuJztcbiAgfVxuICBpZiAocGF0aCAmJiB0cmFpbGluZ1NsYXNoKSB7XG4gICAgcGF0aCArPSAnLyc7XG4gIH1cblxuICByZXR1cm4gKGlzQWJzb2x1dGUgPyAnLycgOiAnJykgKyBwYXRoO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5pc0Fic29sdXRlID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuam9pbiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcGF0aHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICByZXR1cm4gZXhwb3J0cy5ub3JtYWxpemUoZmlsdGVyKHBhdGhzLCBmdW5jdGlvbihwLCBpbmRleCkge1xuICAgIGlmICh0eXBlb2YgcCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLmpvaW4gbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfVxuICAgIHJldHVybiBwO1xuICB9KS5qb2luKCcvJykpO1xufTtcblxuXG4vLyBwYXRoLnJlbGF0aXZlKGZyb20sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZWxhdGl2ZSA9IGZ1bmN0aW9uKGZyb20sIHRvKSB7XG4gIGZyb20gPSBleHBvcnRzLnJlc29sdmUoZnJvbSkuc3Vic3RyKDEpO1xuICB0byA9IGV4cG9ydHMucmVzb2x2ZSh0bykuc3Vic3RyKDEpO1xuXG4gIGZ1bmN0aW9uIHRyaW0oYXJyKSB7XG4gICAgdmFyIHN0YXJ0ID0gMDtcbiAgICBmb3IgKDsgc3RhcnQgPCBhcnIubGVuZ3RoOyBzdGFydCsrKSB7XG4gICAgICBpZiAoYXJyW3N0YXJ0XSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIHZhciBlbmQgPSBhcnIubGVuZ3RoIC0gMTtcbiAgICBmb3IgKDsgZW5kID49IDA7IGVuZC0tKSB7XG4gICAgICBpZiAoYXJyW2VuZF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPiBlbmQpIHJldHVybiBbXTtcbiAgICByZXR1cm4gYXJyLnNsaWNlKHN0YXJ0LCBlbmQgLSBzdGFydCArIDEpO1xuICB9XG5cbiAgdmFyIGZyb21QYXJ0cyA9IHRyaW0oZnJvbS5zcGxpdCgnLycpKTtcbiAgdmFyIHRvUGFydHMgPSB0cmltKHRvLnNwbGl0KCcvJykpO1xuXG4gIHZhciBsZW5ndGggPSBNYXRoLm1pbihmcm9tUGFydHMubGVuZ3RoLCB0b1BhcnRzLmxlbmd0aCk7XG4gIHZhciBzYW1lUGFydHNMZW5ndGggPSBsZW5ndGg7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoZnJvbVBhcnRzW2ldICE9PSB0b1BhcnRzW2ldKSB7XG4gICAgICBzYW1lUGFydHNMZW5ndGggPSBpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdmFyIG91dHB1dFBhcnRzID0gW107XG4gIGZvciAodmFyIGkgPSBzYW1lUGFydHNMZW5ndGg7IGkgPCBmcm9tUGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICBvdXRwdXRQYXJ0cy5wdXNoKCcuLicpO1xuICB9XG5cbiAgb3V0cHV0UGFydHMgPSBvdXRwdXRQYXJ0cy5jb25jYXQodG9QYXJ0cy5zbGljZShzYW1lUGFydHNMZW5ndGgpKTtcblxuICByZXR1cm4gb3V0cHV0UGFydHMuam9pbignLycpO1xufTtcblxuZXhwb3J0cy5zZXAgPSAnLyc7XG5leHBvcnRzLmRlbGltaXRlciA9ICc6JztcblxuZXhwb3J0cy5kaXJuYW1lID0gZnVuY3Rpb24ocGF0aCkge1xuICB2YXIgcmVzdWx0ID0gc3BsaXRQYXRoKHBhdGgpLFxuICAgICAgcm9vdCA9IHJlc3VsdFswXSxcbiAgICAgIGRpciA9IHJlc3VsdFsxXTtcblxuICBpZiAoIXJvb3QgJiYgIWRpcikge1xuICAgIC8vIE5vIGRpcm5hbWUgd2hhdHNvZXZlclxuICAgIHJldHVybiAnLic7XG4gIH1cblxuICBpZiAoZGlyKSB7XG4gICAgLy8gSXQgaGFzIGEgZGlybmFtZSwgc3RyaXAgdHJhaWxpbmcgc2xhc2hcbiAgICBkaXIgPSBkaXIuc3Vic3RyKDAsIGRpci5sZW5ndGggLSAxKTtcbiAgfVxuXG4gIHJldHVybiByb290ICsgZGlyO1xufTtcblxuXG5leHBvcnRzLmJhc2VuYW1lID0gZnVuY3Rpb24ocGF0aCwgZXh0KSB7XG4gIHZhciBmID0gc3BsaXRQYXRoKHBhdGgpWzJdO1xuICAvLyBUT0RPOiBtYWtlIHRoaXMgY29tcGFyaXNvbiBjYXNlLWluc2Vuc2l0aXZlIG9uIHdpbmRvd3M/XG4gIGlmIChleHQgJiYgZi5zdWJzdHIoLTEgKiBleHQubGVuZ3RoKSA9PT0gZXh0KSB7XG4gICAgZiA9IGYuc3Vic3RyKDAsIGYubGVuZ3RoIC0gZXh0Lmxlbmd0aCk7XG4gIH1cbiAgcmV0dXJuIGY7XG59O1xuXG5cbmV4cG9ydHMuZXh0bmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHNwbGl0UGF0aChwYXRoKVszXTtcbn07XG5cbmZ1bmN0aW9uIGZpbHRlciAoeHMsIGYpIHtcbiAgICBpZiAoeHMuZmlsdGVyKSByZXR1cm4geHMuZmlsdGVyKGYpO1xuICAgIHZhciByZXMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChmKHhzW2ldLCBpLCB4cykpIHJlcy5wdXNoKHhzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbn1cblxuLy8gU3RyaW5nLnByb3RvdHlwZS5zdWJzdHIgLSBuZWdhdGl2ZSBpbmRleCBkb24ndCB3b3JrIGluIElFOFxudmFyIHN1YnN0ciA9ICdhYicuc3Vic3RyKC0xKSA9PT0gJ2InXG4gICAgPyBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7IHJldHVybiBzdHIuc3Vic3RyKHN0YXJ0LCBsZW4pIH1cbiAgICA6IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBsZW4pIHtcbiAgICAgICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSBzdHIubGVuZ3RoICsgc3RhcnQ7XG4gICAgICAgIHJldHVybiBzdHIuc3Vic3RyKHN0YXJ0LCBsZW4pO1xuICAgIH1cbjtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhdGhuYW1lKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNtb2RlLXN3aXRjaCcpXG4gICAgLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIC8vIERvIG5vdCB2YWxpZGF0ZSB0aGUgZm9ybS5cbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcblxuICAgICAgLy8gRG8gbm90IGFkZCBhICMgVVJMIHRvIHRoZSBsb2NhdGlvbiBoaXN0b3J5LlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbXVxuXG4gICAgICBjb25zdCByZWFkVGltZW91dCA9IGdldFJlYWRUaW1lb3V0KClcbiAgICAgIGlmKHJlYWRUaW1lb3V0KXtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKGByZWFkX3RpbWVvdXQ9JHtyZWFkVGltZW91dH1gKVxuICAgICAgfVxuXG4gICAgICBjb25zdCB0YXJnZXQgPSBnZXRUYXJnZXQoKVxuICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2goYHRhcmdldD0ke3RhcmdldH1gKVxuICAgICAgfVxuXG4gICAgICBjb25zdCBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25scWZvcm0nKVxuICAgICAgaWYgKGZvcm0ucXVlcnkudmFsdWUpIHtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKGBxdWVyeT0ke2VuY29kZVVSSUNvbXBvbmVudChmb3JtLnF1ZXJ5LnZhbHVlKX1gKVxuICAgICAgfVxuXG4gICAgICBsb2NhdGlvbi5ocmVmID0gYC8ke3BhdGhuYW1lfT8ke3BhcmFtZXRlcnMuam9pbignJicpfWBcbiAgICB9KVxufVxuXG5mdW5jdGlvbiBnZXRSZWFkVGltZW91dCgpIHtcbiAgY29uc3QgcGFyYW1ldGVyID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKVxuICAgIC5zZWFyY2hQYXJhbXMuZ2V0KCdyZWFkX3RpbWVvdXQnKVxuICBpZiAocGFyYW1ldGVyKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChwYXJhbWV0ZXIpXG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VGFyZ2V0KCkge1xuICAvLyBBIHVzZXIgY2FuIHNlbGVjdCB0aGUgdGFyZ2V0IGF0IHRoZSBleHBlcnQgbW9kZS5cbiAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNubHFmb3JtIGlucHV0W25hbWU9XCJ0YXJnZXRcIl0nKVxuICBpZiAoZWxlbWVudCkge1xuICAgIHJldHVybiBlbGVtZW50LnZhbHVlXG4gIH1cblxuICAvLyBUaGUgdGFyZ2V0IGlzIG5vdCBjaGVuZ2VkIGluIHRoZSBzaW1wbGUgbW9kZSBvciB0aGUgYW5zd2VyIHBhZ2UuXG4gIGNvbnN0IHBhcmFtZXRlciA9IG5ldyBVUkwobG9jYXRpb24uaHJlZilcbiAgICAuc2VhcmNoUGFyYW1zLmdldCgndGFyZ2V0JylcbiAgaWYgKHBhcmFtZXRlcikge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocGFyYW1ldGVyKVxuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGFyc2UtaXQtYnV0dG9uJylcblxuICBpZiAoYnV0dG9uKSB7XG4gICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGNvbnN0IGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbmxxZm9ybScpXG5cbiAgICAgIGlmIChmb3JtLmNoZWNrVmFsaWRpdHkoKSkge1xuICAgICAgICAvLyBEbyBub3Qgc3VibWl0IGZvcm0uXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICBsb2NhdGlvbi5ocmVmID0gYC9ncmFwaGVkaXRvcj9xdWVyeT0ke2VuY29kZVVSSUNvbXBvbmVudChmb3JtLnF1ZXJ5LnZhbHVlKX0mdGFyZ2V0PSR7Zm9ybS50YXJnZXQudmFsdWV9YFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9ybS5xdWVyeVNlbGVjdG9yKCcjcXVlcnknKVxuICAgICAgICAgIC5mb2N1cygpXG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwiY29uc3QgeyB1cGRhdGVDb25maWcgfSA9IHJlcXVpcmUoJy4uL3VwZGF0ZS1zYW1wbGUtcXVlcmllcycpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIHNldFRhcmdldERpc3BsYXkoY29uZmlnKVxuICBzZXRObHFGb3JtVGFyZ2V0KGNvbmZpZylcbiAgc2V0RW5kcG9pbnQoY29uZmlnKVxuICB1cGRhdGVDb25maWcoY29uZmlnKVxufVxuXG5mdW5jdGlvbiBzZXRUYXJnZXREaXNwbGF5KGNvbmZpZykge1xuICBpZiAoY29uZmlnWydob21lJ10pIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGFyZ2V0LWRpc3BsYXknKVxuICAgICAgLmlubmVySFRNTCA9IGBAPGEgaHJlZj1cIiR7Y29uZmlnWydob21lJ119XCI+JHtjb25maWdbJ25hbWUnXX08L2E+YFxuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0YXJnZXQtZGlzcGxheScpXG4gICAgICAuaW5uZXJIVE1MID0gYEAke2NvbmZpZ1snbmFtZSddfWBcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXRObHFGb3JtVGFyZ2V0KGNvbmZpZykge1xuICAvLyB0byBzZXR1cCB0YXJnZXQgaW4gTkxRIGZvcm1cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25scWZvcm0gaW5wdXRbbmFtZT1cInRhcmdldFwiXScpXG4gICAgLnZhbHVlID0gY29uZmlnLm5hbWVcbn1cblxuZnVuY3Rpb24gc2V0RW5kcG9pbnQoY29uZmlnKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNlbmRwb2ludC11cmwnKVxuICAgIC52YWx1ZSA9IGNvbmZpZy5lbmRwb2ludF91cmxcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25lZWQtcHJveHknKVxuICAgIC52YWx1ZSA9IChjb25maWcubmFtZSA9PT0gJ2Jpb2dhdGV3YXknKVxufVxuIiwiY29uc3QgZ2V0VGFyZ2V0Q29uZmlnID0gcmVxdWlyZSgnLi4vLi4vLi4vLi4vZ2V0LXRhcmdldC1jb25maWcnKVxuY29uc3QgYXBwbHlDb25maWcgPSByZXF1aXJlKCcuL2FwcGx5LWNvbmZpZycpXG5jb25zdCBzZXREaWN0aW9uYXJ5VXJsID0gcmVxdWlyZSgnLi9zZXQtZGljdGlvbmFyeS11cmwnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCwgZWRpdG9yID0gbnVsbCkge1xuICBnZXRUYXJnZXRDb25maWcodGFyZ2V0KVxuICAgIC5jYXRjaCgoKSA9PiBjb25zb2xlLmxvZygnR2F0ZXdheSBlcnJvciEnKSlcbiAgICAudGhlbigoY29uZmlnKSA9PiB7XG4gICAgICBhcHBseUNvbmZpZyhjb25maWcpXG4gICAgICBpZiAoZWRpdG9yKSB7XG4gICAgICAgIHNldERpY3Rpb25hcnlVcmwoZWRpdG9yLCBjb25maWcpXG4gICAgICB9XG4gICAgfSlcbn1cbiIsImNvbnN0IGNoYW5nZVRhcmdldCA9IHJlcXVpcmUoJy4vY2hhbmdlLXRhcmdldCcpXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJpbmRUYXJnZXRDaGFuZ2VFdmVudGhhbmRsZXIoZWRpdG9yKSB7XG4gIC8vIGFkZCBldmVudCBsaXN0ZW5lcnNcbiAgY29uc3Qgc2VsZWN0b3IgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGFyZ2V0JylcbiAgaWYoc2VsZWN0b3IpIHtcbiAgICBzZWxlY3Rvci5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4gY2hhbmdlVGFyZ2V0KGUudGFyZ2V0LnZhbHVlLCBlZGl0b3IpKVxuXG4gICAgLy8gaW5pdGlhbCB0YXJnZXRcbiAgICBjaGFuZ2VUYXJnZXQoc2VsZWN0b3IudmFsdWUsIGVkaXRvcilcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlZGl0b3IsIGNvbmZpZykge1xuICBjb25zdCBkaWNVcmwgPSBjb25maWcuZGljdGlvbmFyeV91cmxcbiAgY29uc3QgcHJlZERpY1VybCA9IGNvbmZpZy5wcmVkX2RpY3Rpb25hcnlfdXJsXG4gIGVkaXRvci5zZXREaWN0aW9uYXJ5VXJsKGRpY1VybCwgcHJlZERpY1VybClcbn1cbiIsImNvbnN0IGJpbmRNb2RlU3dpdGNoQnV0dG9uRXZlbnRoYW5kbGVyID0gcmVxdWlyZSgnLi4vLi4vYmluZC1tb2RlLXN3aXRjaC1ldmVudGhhbmRsZXInKVxuY29uc3QgaW5pdFNhbXBsZVF1ZXJpZXMgPSByZXF1aXJlKCcuL2luaXQtc2FtcGxlLXF1ZXJpZXMnKVxuY29uc3QgYmluZFBhcnNlSXRCdXR0b25FdmVudGhhbmRsZXIgPSByZXF1aXJlKCcuL2JpbmQtcGFyc2UtaXQtYnV0dG9uLWV2ZW50aGFuZGxlcicpXG5jb25zdCBpbml0R3JwYWhFZGl0b3IgPSByZXF1aXJlKCcuL2luaXQtZ3JwYWgtZWRpdG9yJylcbmNvbnN0IGJpbmRUYXJnZXRDaGFuZ2VFdmVudGhhbmRsZXIgPSByZXF1aXJlKCcuL2JpbmQtdGFyZ2V0LWNoYW5nZS1ldmVudGhhbmRsZXInKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICBpbml0U2FtcGxlUXVlcmllcygpXG4gIGJpbmRNb2RlU3dpdGNoQnV0dG9uRXZlbnRoYW5kbGVyKCcnKVxuICBiaW5kUGFyc2VJdEJ1dHRvbkV2ZW50aGFuZGxlcigpXG5cbiAgY29uc3QgZWRpdG9yID0gaW5pdEdycGFoRWRpdG9yKClcbiAgYmluZFRhcmdldENoYW5nZUV2ZW50aGFuZGxlcihlZGl0b3IpXG59XG4iLCIvKiBnbG9iYWwgZ3JhcGhFZGl0b3IgKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIGlmICh3aW5kb3cuZ3JhcGhFZGl0b3IpIHtcbiAgICBjb25zdCBlZGl0b3IgPSBncmFwaEVkaXRvcignL3Rlcm1maW5kZXInKVxuXG4gICAgLy8gaW5pdCBncmFwaFxuICAgIGVkaXRvci5hZGRQZ3AoSlNPTi5wYXJzZShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbG9kcWEtcGdwJylcbiAgICAgIC5pbm5lckhUTUwpKVxuXG4gICAgcmV0dXJuIGVkaXRvclxuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAvLyBTaG93IG9yIGhpZGUgc2FtcGxlIHF1ZXJpZXMgd2hlbiB0aGUgYnV0dG9uIGlzIGNsaWNrZWQuXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNidXR0b24tc2hvdy1xdWVyaWVzJylcbiAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgICAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5leGFtcGxlcycpXG4gICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2V4YW1wbGVzLS1oaWRkZW4nKVxuICAgICAgfVxuICAgIH0pXG5cbiAgLy8gSGlkZSBzYW1wbGUgcXVlcmllcyB3aGVuIGl0IGlzIGNsaWNrZWQuXG4gIGNvbnN0IHF1ZXJpZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2FtcGxlLXF1ZXJpZXMnKVxuICBpZiAocXVlcmllcykge1xuICAgIHF1ZXJpZXMuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmV4YW1wbGVzJylcbiAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZXhhbXBsZXMtLWhpZGRlbicpXG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwiY29uc3QgaGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMnKVxuXG5jb25zdCB0ZW1wbGF0ZSA9IGhhbmRsZWJhcnMuY29tcGlsZShgXG4gIHt7I2VhY2ggdGhpc319XG4gICAgPGxpPjxhIGhyZWY9XCJ7e2hyZWZ9fVwiPnt7cXVlcnl9fTwvYT48L2xpPlxuICB7ey9lYWNofX1cbmApXG5jb25zdCBjYWNoZSA9IHt9XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB1cGRhdGVDb25maWcoY29uZmlnKSB7XG4gICAgY2FjaGUuY29uZmlnID0gY29uZmlnXG4gICAgdXBkYXRlKGNhY2hlLmNvbmZpZywgY2FjaGUucmVhZFRpbWVvdXQpXG4gIH0sXG4gIHVwZGF0ZVJlYWRUaW1lb3V0KHJlYWRUaW1lb3V0KXtcbiAgICBjYWNoZS5yZWFkVGltZW91dCA9IHJlYWRUaW1lb3V0XG4gICAgdXBkYXRlKGNhY2hlLmNvbmZpZywgY2FjaGUucmVhZFRpbWVvdXQpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlKGNvbmZpZywgcmVhZFRpbWVvdXQpIHtcbiAgY29uc3Qge1xuICAgIG5hbWUsXG4gICAgc2FtcGxlX3F1ZXJpZXNcbiAgfSA9IGNvbmZpZ1xuICBjb25zdCBkb20gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2FtcGxlLXF1ZXJpZXMnKVxuXG4gIGlmIChzYW1wbGVfcXVlcmllcykge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZilcbiAgICBjb25zdCBkYXRhID0gc2FtcGxlX3F1ZXJpZXMubWFwKChxdWVyeSkgPT4ge1xuICAgICAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoJ3RhcmdldCcsIG5hbWUpXG4gICAgICB1cmwuc2VhcmNoUGFyYW1zLnNldCgncXVlcnknLCBxdWVyeSlcblxuICAgICAgaWYocmVhZFRpbWVvdXQpIHtcbiAgICAgICAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoJ3JlYWRfdGltZW91dCcsIHJlYWRUaW1lb3V0KVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBxdWVyeSxcbiAgICAgICAgaHJlZjogdXJsLnRvU3RyaW5nKClcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgZG9tLmlubmVySFRNTCA9IHRlbXBsYXRlKGRhdGEpXG4gIH0gZWxzZSB7XG4gICAgZG9tLmlubmVySFRNTCA9ICcnXG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0KSB7XG4gIGNvbnN0IG15SGVhZGVycyA9IG5ldyBIZWFkZXJzKClcbiAgbXlIZWFkZXJzLnNldCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKVxuXG4gIHJldHVybiBmZXRjaChgaHR0cDovL3RhcmdldHMubG9kcWEub3JnL3RhcmdldHMvJHt0YXJnZXR9YCwge1xuICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgaGVhZGVyczogbXlIZWFkZXJzXG4gIH0pXG4gICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpXG4gICAgfSlcbn1cbiIsImNvbnN0IGluaXREYXNoYm9hcmQgPSByZXF1aXJlKCcuL2NvbnRyb2xsZXIvZ3JhcGhlZGl0b3IvZGFzaGJvYXJkJylcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcbiAgaW5pdERhc2hib2FyZCgpXG5cbiAgY29uc3QgZGFzaGJvYXJkID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Rhc2hib2FyZCcpXG4gIGNvbnN0IHJlc3VsdHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcmVzdWx0cycpXG5cbiAgZGFzaGJvYXJkLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIGRhc2hib2FyZC5jbGFzc0xpc3QucmVtb3ZlKCdkYXNoYm9hcmQtLWJhY2snKVxuICAgIHJlc3VsdHMuY2xhc3NMaXN0LmFkZCgncmVzdWx0cy0tYmFjaycpXG5cbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZXhhbXBsZXMnKVxuICAgICAgLmNsYXNzTGlzdC5hZGQoJ2V4YW1wbGVzLS1oaWRkZW4nKVxuICB9KVxuXG4gIHJlc3VsdHMuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgZGFzaGJvYXJkLmNsYXNzTGlzdC5hZGQoJ2Rhc2hib2FyZC0tYmFjaycpXG4gICAgcmVzdWx0cy5jbGFzc0xpc3QucmVtb3ZlKCdyZXN1bHRzLS1iYWNrJylcbiAgfSlcbn0pXG4iXX0=
