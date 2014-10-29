(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
window.onload = function() {
  var bindSolutionState = function(loader, presentation) {
      var data = {},
        domId = 'lodqa-results';

      loader
        .on('anchored_pgp', _.partial(presentation.onAnchoredPgp, domId, data))
        .on('solution', _.partial(presentation.onSolution, data));
    },
    bindWebsocketState = function(loader) {
      var presentation = require('./presentation/websocketPresentation');
      loader
        .on('ws_open', presentation.onOpen)
        .on('ws_close', presentation.onClose);
    },
    bindParseRenderingState = function(loader) {
      loader.on("parse_rendering", function(data) {
        document.getElementById('lodqa-parse_rendering').innerHTML = data;
      });
    };

  var loader = require('./loader/loadSolution')();
  // var loader = require('./loader/loadSolutionStub')();

  bindSolutionState(loader, require('./presentation/tablePresentation'));
  bindSolutionState(loader, require('./presentation/graphPresentation'));
  bindSolutionState(loader, require('./presentation/debugPresentation'));

  bindWebsocketState(loader);
  bindParseRenderingState(loader);
}

},{"./loader/loadSolution":3,"./presentation/debugPresentation":4,"./presentation/graphPresentation":5,"./presentation/tablePresentation":6,"./presentation/websocketPresentation":7}],3:[function(require,module,exports){
module.exports = function() {
  var ws = new WebSocket(location.href.replace('http://', 'ws://')),
    event = require('events'),
    emitter = new event.EventEmitter;

  ws.onopen = function() {
    emitter.emit('ws_open');
  };
  ws.onclose = function() {
    emitter.emit('ws_close');
  };
  ws.onmessage = function(m) {
    if (m.data === 'start') return;

    var jsondata = JSON.parse(m.data);

    ["anchored_pgp", "solution", "parse_rendering"]
    .forEach(function(event) {
      if (jsondata.hasOwnProperty(event)) {
        emitter.emit(event, jsondata[event]);
      }
    });
  };

  return emitter;
};

},{"events":1}],4:[function(require,module,exports){
module.exports = {
  onAnchoredPgp: function(domId, data, anchored_pgp) {
    data.currentRegion = document.createElement('div');
    data.currentRegion.classList.add('section');
    data.currentRegion.style.border = "solid black 1px";
    document.getElementById(domId).appendChild(data.currentRegion);
    data.currentRegion.innerHTML = JSON.stringify(anchored_pgp);
  },
  onSolution: function(data, solution) {
    data.currentRegion.innerHTML += '<br />' + JSON.stringify(solution);
  }
};

},{}],5:[function(require,module,exports){
module.exports = function() {
  var initGraph = function() {
      var graph = new Springy.Graph();
      var canvas = $('<canvas>')
        .attr({
          width: 690,
          height: 400
        });
      $('#lodqa-results').append(canvas);
      canvas.springy({
        graph: graph
      });

      return graph;
    },
    toAnchoredPgpNodeTerm = function(nodes, key) {
      return {
        id: key,
        label: nodes[key].term
      };
    },
    toLabel = function(term) {
      var url = decomposeUrl(term.label),
        path = url.path;

      return {
        id: term.id,
        label: url.hash ? url.hash : path[path.length - 1]
      };
    },
    setFont = function(value, target) {
      return _.extend(target, {
        font: value
      })
    },
    setFontNormal = _.partial(setFont, '8px Verdana, sans-serif'),
    toLabelAndSetFontNormal = _.compose(setFontNormal, toLabel),
    toNode = function(term) {
      return new Springy.Node(term.id, term);
    },
    addNode = function(graph, node) {
      graph.addNode(node);
    },
    toBigFont = _.partial(setFont, '18px Verdana, sans-serif'),
    toRed = function(term) {
      return _.extend(term, {
        color: '#FF512C'
      });
    },
    toFocus = _.compose(toRed, toBigFont),
    setFocus = function(focus, term) {
      return term.id === focus ? toFocus(term) : term;
    },
    extendIndex = function(a, index) {
      a.index = index;
      return a;
    },
    threeNodeOrders = {
      t1: [1, 0, 2],
      t2: [0, 1, 2],
      t3: [0, 2, 1]
    },
    getNodeOrder = function(id) {
      return threeNodeOrders[id];
    },
    getTwoEdgeNode = function(edgeCount) {
      return _.first(Object.keys(edgeCount)
        .map(function(id) {
          return {
            id: id,
            count: edgeCount[id]
          };
        })
        .filter(function(node) {
          return node.count === 2;
        })
        .map(function(node) {
          return node.id;
        }));
    },
    countEdge = function(edges) {
      return edges.reduce(function(edgeCount, edge) {
        edgeCount[edge.subject] ++;
        edgeCount[edge.object] ++;
        return edgeCount;
      }, {
        t1: 0,
        t2: 0,
        t3: 0
      });
    },
    getOrderWhenThreeNode = _.compose(getNodeOrder, getTwoEdgeNode, countEdge),
    sortNode = function(nodeIds, edges, a, b) {
      if (nodeIds.length === 3) {
        var nodeOrder = getOrderWhenThreeNode(edges);

        return nodeOrder[a.index] - nodeOrder[b.index];
      } else {
        return b.index - a.index;
      }
    },
    anchoredPgpNodePositions = [
      [],
      [{
        x: 0,
        y: 0
      }],
      [{
        x: -20,
        y: 20
      }, {
        x: 20,
        y: -20
      }],
      [{
        x: -40,
        y: 40
      }, {
        x: 0,
        y: 0
      }, {
        x: 40,
        y: -40
      }]
    ],
    setPosition = function(number_of_nodes, term, index) {
      return _.extend(term, {
        position: anchoredPgpNodePositions[number_of_nodes][index]
      });
    },
    addAnchoredPgpNodes = function(graph, nodes, focus, edges) {
      var nodeIds = Object.keys(nodes);

      nodeIds
        .map(_.partial(toAnchoredPgpNodeTerm, nodes))
        .map(toLabelAndSetFontNormal)
        .map(_.partial(setFocus, focus))
        .map(extendIndex)
        .sort(_.partial(sortNode, nodeIds, edges))
        .map(_.partial(setPosition, nodeIds.length))
        .map(toNode)
        .forEach(_.partial(addNode, graph));
    },
    toTerm = function(solution, id) {
      return {
        id: id,
        label: solution[id]
      };
    },
    addEdge = function(graph, solution, edgeId, node1, node2, color) {
      return _.first(Object.keys(solution)
        .filter(function(id) {
          return id === edgeId;
        })
        .map(_.partial(toTerm, solution))
        .map(toLabel)
        .map(function(term) {
          return _.extend(term, {
            color: color
          });
        })
        .map(function(term) {
          return graph.newEdge(node1, node2, term)
        }));
    },
    addEdgeToInstance = function(graph, solution, instanceNode) {
      var anchoredPgpNodeId = instanceNode.data.id.substr(1),
        edge_id = 's' + anchoredPgpNodeId,
        anchoredPgpNode = graph.nodeSet[anchoredPgpNodeId];
      addEdge(graph, solution, edge_id, anchoredPgpNode, instanceNode, '#999999');
    },
    addInstanceNode = function(graph, solution, focus) {
      return Object.keys(solution)
        .filter(function(id) {
          return id[0] === 'i';
        })
        .map(_.partial(toTerm, solution))
        .map(toLabelAndSetFontNormal)
        .map(function(term) {
          var tx_id = term.id.substr(1);
          return tx_id === focus ? toRed(term) : term;
        })
        .reduce(function(result, term) {
          var instanceNode = graph.newNode(term);
          addEdgeToInstance(graph, solution, instanceNode);
          result[term.id] = instanceNode;
          return result;
        }, {});
    },
    addTransitNode = function(graph, solution) {
      return Object.keys(solution)
        .filter(function(id) {
          return id[0] === 'x';
        })
        .map(_.partial(toTerm, solution))
        .map(toLabelAndSetFontNormal)
        .reduce(function(result, term) {
          result[term.id] = graph.newNode(term);
          return result;
        }, {});
    },
    toPathInfo = function(pathId) {
      return {
        id: pathId,
        no: pathId[1],
        childNo: parseInt(pathId[2])
      }
    },
    toLeftId = function(edge, pathInfo) {
      var anchoredPgpNodeId = edge.subject,
        instanceNodeId = 'i' + anchoredPgpNodeId;

      return {
        transitNodeId: 'x' + pathInfo.no + (pathInfo.childNo - 1),
        instanceNodeId: 'i' + anchoredPgpNodeId,
        anchoredPgpNodeId: anchoredPgpNodeId
      };
    },
    toRightId = function(edge, pathInfo) {
      var anchoredPgpNodeId = edge.object,
        instanceNodeId = 'i' + anchoredPgpNodeId;

      return {
        transitNodeId: 'x' + pathInfo.no + pathInfo.childNo,
        instanceNodeId: 'i' + anchoredPgpNodeId,
        anchoredPgpNodeId: anchoredPgpNodeId
      };
    },
    toGraphId = function(transitNodes, instanceNodes, canididateIds) {
      if (transitNodes[canididateIds.transitNodeId]) {
        return transitNodes[canididateIds.transitNodeId].id;
      } else if (instanceNodes[canididateIds.instanceNodeId]) {
        return instanceNodes[canididateIds.instanceNodeId].id
      } else {
        return canididateIds.anchoredPgpNodeId;
      }
    },
    toPath = function(graph, edges, transitNodes, instanceNodes, pathInfo) {
      var edge = edges[pathInfo.no],
        toGraphIdFromNodes = _.partial(toGraphId, transitNodes, instanceNodes),
        toGraphNode = _.compose(function(id) {
          return graph.nodeSet[id];
        }, toGraphIdFromNodes);

      return {
        id: pathInfo.id,
        left: toGraphNode(toLeftId(edge, pathInfo)),
        right: toGraphNode(toRightId(edge, pathInfo))
      };
    },
    addPath = function(graph, solution, edges, transitNodes, instanceNodes) {
      return Object.keys(solution)
        .filter(function(id) {
          return id[0] === 'p';
        })
        .map(toPathInfo)
        .map(_.partial(toPath, graph, edges, transitNodes, instanceNodes))
        .reduce(function(result, path) {
          result[path.id] = addEdge(graph, solution, path.id, path.left, path.right, '#2B5CFF');
          return result;
        }, {});
    };

  return {
    onAnchoredPgp: function(domId, data, anchored_pgp) {
      data.graph = initGraph();
      data.focus = anchored_pgp.focus;
      data.edges = anchored_pgp.edges;
      addAnchoredPgpNodes(data.graph, anchored_pgp.nodes, data.focus, data.edges);
    },
    onSolution: function(data, solution) {
      var instanceNodes = addInstanceNode(data.graph, solution, data.focus),
        transitNodes = addTransitNode(data.graph, solution);

      addPath(data.graph, solution, data.edges, transitNodes, instanceNodes);
    }
  };
}();

},{}],6:[function(require,module,exports){
module.exports = {
  onAnchoredPgp: function(domId, data, anchored_pgp) {
    var $region = $('<div>'),
      $table = $('<table>');

    $region
      .addClass('anchored_pgp-table')
      .append($table);

    $table
      .append(
        $('<tr>')
        .append($('<th>'))
        .append($('<th>').text('head'))
        .append($('<th>').text('text'))
        .append($('<th>').text('term'))
      );

    Object.keys(anchored_pgp.nodes)
      .map(function(node_id) {
        var node = anchored_pgp.nodes[node_id],
          $tr = $('<tr>')
          .append($('<td>').text(node_id))
          .append($('<td>').text(node.head))
          .append($('<td>').text(node.text))
          .append($('<td>').text(node.term));

        if (node_id === anchored_pgp.focus) {
          $tr.addClass('focus');
        }

        return $tr;
      })
      .forEach(function($tr) {
        $table.append($tr);
      });

    $('#' + domId).append($region);
  },
  onSolution: _.noop
};

},{}],7:[function(require,module,exports){
var show = function(el) {
    return function(msg) {
      el.innerHTML = msg;
    }
  }(document.getElementById('lodqa-messages')),
  onOpen = function() {
    show('lodqa running ...');
  },
  onClose = function() {
    show('lodqa finished.');
  };

module.exports = {
  onOpen: onOpen,
  onClose: onClose
};

},{}]},{},[2])