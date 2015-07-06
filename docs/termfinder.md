---
layout: docs
title: TermFinder
prev_section: graphicator
next_section: graphfinder
permalink: /docs/termfinder/
---

TermFinder is the second module of the LODQA system.

Once the [Graphicator]({{site.baseurl}}/docs/graphicator/) module has produced a PGP from a given NL query,
the TermFinder module is responsible for finding the URIs and values of the nodes in the PGP, as illustrated below:

<div align="center">
<img src="{{site.baseurl}}/images/termfinder.png" alt="TermFinder" style="height:300px" />
</div>

Note that the URIs and the values have to be those actually appearing in the target dataset.
Otherwise, there is no chance for the PGP to be matched with any part of the dataset.
Through the normalization, each node of the PGP is connected to a corresponding term (URI or value) in the dataset.
We describe it as the PGP is <i>anchored</i> at the dataset,
and we call the PGP an <i>anchored PGP (APGP)</i>.

Note also that often a natural language term may be normalized to more than one RDF terms due to ambiguity or polysemy.
Therefore, more than one APGPs may be produced from one PGP through normalization.
