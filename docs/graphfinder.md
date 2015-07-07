---
layout: docs
title: GraphFinder
prev_section: termfinder
next_section: references
permalink: /docs/graphfinder/
---

GraphFinder is the third module of the LODQA system.

For an APGP produced through the [Graphicator]({{site.baseurl}}/docs/graphicator/) and
the [TermFinder]({{site.baseurl}}/docs/termfinder/) modules,
the GraphFinder module is responsible for searching the target dataset for corresponding parts,
considering possible variations which may occur in the dataset.

To absorb structural descrepancy between the APGP and actual structure in the target dataset,
GraphFinder attempts to generate SPARQL queries for all the possible structural variations, as illustrated below:

<div align="center">
<img src="{{site.baseurl}}/images/graphfinder.png" alt="GraphFinder" style="width:100%" />
</div>

The SPARQL queries are then submitted to the target endpoint and the answers are collected to provide the user with.
