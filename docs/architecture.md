---
layout: docs
title: Architecture
prev_section: intro
next_section: graphicator
permalink: /docs/architecture/
---

The LODQA system has a modular architecture as illustrated below:

<div align="center">
<img src="{{site.baseurl}}/images/architecture.png" alt="architecture" style="height:300px" />
</div>

The system takes a natural language (NL) query as its input,
and finally produces corresponding SPARQL queries, together with the answers to them from (a) certain SPARQL endpoint(s).
The system consists of three modules:
<i>[Graphicator]({{site.baseurl}}/docs/graphicator/)</i>,
<i>[TermFinder]({{site.baseurl}}/docs/termfinder/)</i>, and
<i>[GraphFinder]({{site.baseurl}}/docs/graphfinder/)</i>.
