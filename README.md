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
app.use(logging.attachTimeToReq);
app.use(logging.attachLoggerToReq);
app.use(logging.attachRequestIdToReq());
app.use(logging.logResponses);
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

The following option is exposed on the requestId:
- `warnIfMissingRequestId` - (Optional) Writes a warning to the log if a request is missing an X-Request-ID header
