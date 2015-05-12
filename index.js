var _ = require('lodash'),
  bunyan = require('bunyan'),
  Errio = require('errio'),
  uuid = require('node-uuid');

/**
 * Creates a logging context
 *
 * @param {Object} opts - Options
 * @param {string} opts.environment - A description of the environment
 * @param {string} opts.name - A name for the service
 * @param {Object} [opts.serializers] - Serializers for Bunyan
 * @param {Object[]} opts.streams - Bunyan streams for logging
 * @param {Object} [opts.version] - A version object
 * @return {{attachLoggerToReq: function, attachRequestIdToReq: function, logErrors: function, logResponses: function}} A series of middleware functions. Add in order: attachLoggerToReq, attachRequestIdToReq, logResponses, logErrors
 */
module.exports = function(opts) {
  if (!opts) {
    throw new Error('Need to specify `name`, `environment`, and `streams`');
  }
  if (!opts.name) {
    throw new Error('`name` is required');
  }
  if (!opts.environment) {
    throw new Error('`environment is required');
  }
  if (!opts.streams) {
    throw new Error('`streams` is required');
  }

  var serializers = _.assign({
    err: function(err) {
      var isLikelyErrorType = err.name && err.message;
      return isLikelyErrorType ? Errio.toObject(err) : err;
    },
    req: function(req) {
      if (!req || !req.connection) {
        return req;
      }
      return {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.headers['user-agent']
      };
    },
    res: function(res) {
      if (!res || !res.statusCode) {
        return res;
      }
      return {statusCode: res.statusCode};
    },
    streams: function() {
      return opts.streams;
    }
  }, opts.serializers);

  var logger = bunyan.createLogger({
    name: opts.name + '_' + opts.environment,
    serializers: serializers,
    streams: opts.streams
  }).child({version: opts.version});

  process.once('uncaughtException', function(err) {
    logger.fatal(
      {err: err},
      'Uncaught exception'
    );
    // need to wait for streams to flush before exiting or we lose the error
    // very hacky approach but we don't have access to events or a callback
    // indicating when the streams have flushed as of Bunyan 1.2.1
    // see https://github.com/trentm/node-bunyan/issues/37 for an issue log
    setTimeout(function() {
      throw err;
    }, 25);
  });

  return {
    attachLoggerToReq: function attachToReq(req, res, next) {
      req.logger = logger;
      next();
    },
    attachRequestIdToReq: function(reqIdOpts) {
      reqIdOpts = reqIdOpts || {};
      return function requestId(req, res, next) {
        var requestIdHeader = req.headers['x-request-id'];
        req.requestId = requestIdHeader || uuid.v4();
        req.logger = req.logger.child({requestId: req.requestId});
        if (reqIdOpts.warnIfMissingRequestId && !requestIdHeader) {
          req.logger.warn('X-Request-ID header not present');
        }
        res.setHeader('X-Request-ID', req.requestId);
        next();
      };
    },
    logErrors: function errorLogger(err, req, res, next) {
      req.logger.error({req: req, err: err}, 'Error');
      next();
    },
    logResponses: function responseLogger(req, res, next) {
      res.on('finish', function() {
        req.logger.info({req: req, res: res}, 'Response finished');
      });
      next();
    }
  };
};
