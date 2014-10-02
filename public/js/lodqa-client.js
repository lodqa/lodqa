window.onload = function(){
  (function(){
    var show = function(el){
      return function(msg){ el.innerHTML = msg + '<br />' + el.innerHTML; }
    }(document.getElementById('lodqa-messages'));

    var resultsDiv = document.getElementById('lodqa-results');
    var currentRegion;

    var ws       = new WebSocket('ws://localhost:9292/solutions');
    ws.onopen    = function()  { show('websocket opened!'); };
    ws.onclose   = function()  { show('websocket closed!'); };
    ws.onmessage = function(m) {

      var jsondata = JSON.parse(m.data);

      if ("anchored_pgp" in jsondata) {
        currentRegion = document.createElement('div');
        currentRegion.classList.add('section');
        currentRegion.style.border = "solid black 1px";
        resultsDiv.appendChild(currentRegion);

        // var nodes = jsondata.anchored_pgp.nodes;
        // var table = '<table>';
        // for (tid in nodes) {
        //   table += '<tr><td>' + tid + '</td><td>' + nodes[tid].text + '</td><td>' + nodes[tid].term + '</td></tr>';
        // }
        // table += '</table>'
        // currentRegion.innerHtml = table;
        // console.log (currentRegion.innerHtml);
        // currentRegion.innerHTML = m.data;
        currentRegion.innerHTML = JSON.stringify(jsondata.anchored_pgp.nodes);
      } else if ("solution" in jsondata) {
        currentRegion.innerHTML += '<br />' + JSON.stringify(jsondata.solution);
        console.log (currentRegion.innerHtml);
      } else {
        show('websocket message: ' +  m.data);
      }
    };
  })();
}
