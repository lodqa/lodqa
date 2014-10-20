(function() {
  this.lodqaClient = this.lodqaClient || {};
  this.lodqaClient.loadSolutionStub = function() {
    var emitter = new events.EventEmitter(),
      delayCounter = 100,
      emmitSolution = function(anchored_pgp, solutions) {
        _.delay(function() {
          emitter.emit('anchored_pgp', anchored_pgp);
        }, delayCounter);

        solutions
          .forEach(function(solution, index) {
            _.delay(function() {
              emitter.emit('solution', solution);
            }, delayCounter += 100);
          });
      };

    [{
      anchored_pgp: {
        "nodes": {
          "t1": {
            "head": 3,
            "text": "side effects",
            "term": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/side_effects"
          },
          "t2": {
            "head": 5,
            "text": "drugs",
            "term": "http://www4.wiwiss.fu-berlin.de/drugbank/resource/drugbank/drugs"
          },
          "t3": {
            "head": 8,
            "text": "asthma",
            "term": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/116"
          }
        },
        "edges": [{
          "subject": "t1",
          "object": "t2",
          "text": "of"
        }, {
          "subject": "t1",
          "object": "t3",
          "text": "used for"
        }],
        "focus": "t1"
      },
      solutions: [{
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0004096",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "it2": "http://www4.wiwiss.fu-berlin.de/drugbank/resource/drugs/DB00005",
        "st2": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www.w3.org/2002/07/owl#sameAs",
        "x01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/116",
        "p02": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/possibleDrug",
        "p11": "http://www.w3.org/2002/07/owl#sameAs"
      }]
    }, {
      anchored_pgp: {
        "nodes": {
          "t1": {
            "head": 2,
            "text": "side effects",
            "term": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/side_effects"
          },
          "t2": {
            "head": 6,
            "text": "streptomycin",
            "term": "http://www4.wiwiss.fu-berlin.de/drugbank/resource/drugs/DB01082"
          }
        },
        "edges": [{
          "subject": "t1",
          "object": "t2",
          "text": "associated with"
        }],
        "focus": "t1"
      },
      solutions: [{
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002878",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002994",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0011053",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0040034",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0041296",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002418",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002792",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0004610",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0007947",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0011606",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002878",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002994",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0011053",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0040034",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0041296",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002418",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002792",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0004610",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0007947",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0011606",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "x01": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect",
        "p02": "http://www.w3.org/2002/07/owl#sameAs"
      }]
    }, {
      anchored_pgp: {
        "nodes": {
          "t1": {
            "head": 2,
            "text": "side effects",
            "term": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/side_effects"
          },
          "t2": {
            "head": 6,
            "text": "streptomycin",
            "term": "http://www4.wiwiss.fu-berlin.de/sider/resource/drugs/5297"
          }
        },
        "edges": [{
          "subject": "t1",
          "object": "t2",
          "text": "associated with"
        }],
        "focus": "t1"
      },
      solutions: [{
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002878",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002994",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0011053",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0040034",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0041296",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002418",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0002792",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0004610",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0007947",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }, {
        "it1": "http://www4.wiwiss.fu-berlin.de/sider/resource/side_effects/C0011606",
        "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "p01": "http://www4.wiwiss.fu-berlin.de/sider/resource/sider/sideEffect"
      }]
    }]
    .forEach(function(solution) {
      emmitSolution(solution.anchored_pgp, solution.solutions);
    });

    return emitter;
  };
}.call(this));
