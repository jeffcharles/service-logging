# Service Logging

[![NPM](https://nodei.co/npm/service-logging.png)](https://nodei.co/npm/service-logging/)

[![Build Status](https://travis-ci.org/jeffcharles/service-logging.svg?branch=master)](https://travis-ci.org/jeffcharles/service-logging)

Does some logging bootstrapping with Bunyan and basic serializers and exposes Connect middleware to wire up logging in a service.

## Usage

```JavaScript
var express = require('express'),
  myStreams = require('./my-streams'),
  logging = require('service-logging')({
    name: 'my-service',
    environment: 'dev',
    streams: myStreams
  });

var app = express();
app.use(logging.attachLoggerToReq); // adds req.logger
app.use(logging.logResponses);
app.use(function(req, res, next) {
  req.thing = 'otherThing';
  next();
});
app.use(logging.attachToLogger('thing')); // {thing: 'otherThing'} is now added to future req.logger calls
app.get('/', function(req, res) {
  res.send('Hello!');
});
app.use(logging.logErrors);
```

## Configuration

The following options are exposed on the context:
- `environment` - A description of the environment (e.g., dev, staging)
- `name` - The service's name
- `streams` - Bunyan streams to write to (takes an array, not a function)
- `serializers` - (Optional) Additional Bunyan serializers
- `version` - (Optional) Version object to include in logs
