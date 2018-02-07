LODQA
=============
LODQA (Linked Open Data Question-Answering) is a system to generate SPARQL queries from natural language queries.


Dependency
----------
The Current LODQA system is dependent on two external services:

- [Enju](http://kmcs.nii.ac.jp/enju/) CGI server at [http://bionlp.dbcls.jp/enju](http://bionlp.dbcls.jp/enju).
- OntoFinder REST WS at [http://ontofinder.dbcls.jp](http://ontofinder.dbcls.jp).

Currently, LODQA is developed and tested in Ruby v2.1.1.


License
-------
Released under the [MIT license](http://opensource.org/licenses/MIT).

## Getting Started

```
git clone git@github.com:lodqa/lodqa.git
cd lodqa
rackup
```
### Prerequisites

LODQA depends on [graphviz](http://www.graphviz.org/) and some ruby gems.
Install them:

### Installing

Install the graphviz.
For exapmle for the ubuntu.

```
sudo apt-get install -y graphviz
```

Install gem packages:

```
bundle install
```

## Docker guide

```
docker-compose up
```

## Development

### Prerequisites

LODQA depends on some npm packages and some bower packages to develop.
Install them:

### Installing
Install [Node.js](https://nodejs.org). For exapmle for ubuntu:

```
curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
sudo apt-get install -y nodejs
```

For other operating systems, see [Installing Node.js via package manager | Node.js](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)

Install npm packages:

```
npm install
```

Install bower packages:
```
npm i -g bower
bower install
```

## Deployment

Add additional notes about how to deploy this on a live system
