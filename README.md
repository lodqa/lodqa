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
bundle Install
bundle exec rackup -s puma -E deployment
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

## Deployment

### Google authentication procedure

Execute the following ur in the browser and log in with the lodqa specific user account.
```
https://console.developers.google.com/
```

Create a lodqa project.
Example:
```
Lodqa Dialog Management
```

Click link(Enable APIs and services) to activate the API library:
 ```
 Gmail API
 ```

OAuth consent screen.

User Type:
```
 External
```
application name:
```
Lodqa Dialog Management
```

Create authentication information(OAuth Client ID).
Application type:
```
Web Application
```
After creating an OAuth client, client id and client secret are generated:

client id
```
99999999999-xx99x9xx9xxxxxx9x9xx9xx9xxxxxx.apps.googleusercontent.com
```
client secret
```
xxxxxxxxx9xxxx9xx9x9xx99
```

Add an approved redirect URI.
```
[Same URL as environment variable(LODQA)]/oauth
```

### Added environment variable settings.（lodqa/docker-compose.yml）
```
LODQA_OAUTH=[Same URL as environment variable(LODQA)]
```

### Create .env file.
```
cp .env.example .env
```

### .env file settings.
```
CLIENT_ID=[Generated client id]
CLIENT_SECRET=[Generated client secret]
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
