---
layout: docs
title: Graphicator
prev_section: architecture
next_section: termfinder
permalink: /docs/graphicator/
---

Graphicator is the first module of the LODQA system.

It produces a graph representation of a given NL query as illustrated below:

<div align="center">
<img src="{{site.baseurl}}/images/graphicator.png" alt="Graphicator" style="height:300px" />
</div>

As the first module which handles the NL query,
it is responsible for parsing the NL query,
and producing a structured graph representation of the query, which we call a <i>pseudo graph pattern (PGP)</i>.
A PGP contains <i>nodes</i> and <i>relations</i>.
Typically, the nodes correspond to the basic noun phrases (BNPs) in the NL query,
and the relations to the dependency paths between the BNPs as expressed in the NL query.
Additionally, a PGP specifies which node is the <i>focus</i> of the query,
i.e. what the user wants to get as the answer of the query, e.g., "genes" in the above example query.

A PGP is a graph pattern as we want to search a target RDF graph for sub-graphs which correspond to the PGP.
However, we call it a "pseudo" graph pattern, since it is not yet grounded at the target dataset.