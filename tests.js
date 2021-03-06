var assert = require('assert'),
  bunyan = require('bunyan'),
  express = require('express'),
  request = require('supertest-as-promised'),
  logging = require('./');

function createRingBuffer() {
  return new bunyan.RingBuffer({limit: 100});
}

function setupServer(ringBuffer, opts) {
  opts = opts || {};
  var app = express();
  var loggingContext = logging({
    name: 'logger',
    environment: 'dev',
    serializers: opts.serializers,
    streams: [{type: 'raw', stream: ringBuffer}],
    version: opts.version,
    stackTrace: opts.stackTrace
  });
  app.use(loggingContext.attachLoggerToReq);
  app.use(loggingContext.logResponses);
  app.use(function(req, res, next) {
    req.foo = 'bar';
    next();
  });
  app.use(loggingContext.attachToLogger('foo'));
  app.get('/', function(req, res) {
    res.end();
  });
  app.get('/error', function(req, res, next) {
    next(new Error('Error!'));
  });
  app.get('/error/ca', function(req, res, next) {
    var error = new Error('Error!');
    error.response = {
      request: {
        _ca: 'a very long string'
      }
    };
    next(error);
  });
  app.use(loggingContext.logErrors);
  return app;
}

describe('logging', function() {
  it('should log responses', function() {
    var ringBuffer = createRingBuffer();
    return request(setupServer(ringBuffer)).get('/')
      .then(function() {
        var logs = ringBuffer.records;
        assert.equal(logs.length, 1, 'Should be one record');
        assert.equal(logs[0].msg, 'Response finished');
      });
  });

  it('should log errors', function() {
    var ringBuffer = createRingBuffer();
    return request(setupServer(ringBuffer)).get('/error')
      .then(function() {
        var logs = ringBuffer.records;
        assert.equal(logs.length, 2, 'Should be two records');
        assert.equal(logs[0].msg, 'Error');
        assert.equal(logs[1].msg, 'Response finished');
        assert.ok(logs[1].requestId === logs[0].requestId);
      });
  });

  it('should log errors with stack traces', function() {
    var ringBuffer = createRingBuffer();
    return request(setupServer(ringBuffer, {stackTrace: true})).get('/error')
      .then(function() {
        var logs = ringBuffer.records;
        assert.equal(logs.length, 2, 'Should be two records');
        assert.equal(logs[0].msg, 'Error');
        assert.notEqual(logs[0].err.stack, undefined, 'Should include stack trace');
        assert.equal(logs[1].msg, 'Response finished');
        assert.ok(logs[1].requestId === logs[0].requestId);
      });
  });

  it('should not include _ca', function() {
    var ringBuffer = createRingBuffer();
    return request(setupServer(ringBuffer)).get('/error/ca')
      .then(function() {
        var logs = ringBuffer.records;
        assert.equal(logs[0].err.response.request._ca, undefined, 'Should not include _ca');
      });
  });

  it('should log version if provided', function() {
    var ringBuffer = createRingBuffer();
    var version = {foo: 'bar'};
    return request(setupServer(ringBuffer, {version: version})).get('/')
      .then(function() {
        assert.deepEqual(ringBuffer.records[0].version, version);
      });
  });

  it('should add additional specified serializers', function() {
    var ringBuffer = createRingBuffer();
    return request(setupServer(ringBuffer, {serializers: {req: function() {
      return 'bar';
    }}})).get('/')
      .then(function() {
        assert.ok(ringBuffer.records[0].req, 'bar');
      });
  });

  it('should add things to logger', function() {
    var ringBuffer = createRingBuffer();
    return request(setupServer(ringBuffer)).get('/')
      .then(function() {
        assert.equal(ringBuffer.records[0].foo, 'bar');
      });
  });
});
