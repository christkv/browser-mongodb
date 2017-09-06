"use strict"

var EventEmitter = require('events').EventEmitter,
  f = require('util').format,
  ERRORS = require('../../mongodb/errors');

// Connection Id
var id = 0;

class Connection extends EventEmitter {
  constructor(url, server, handlers) {
    super();
    var self = this;
    this.handlers = handlers;
    this.id = (id++) % Number.MAX_VALUE;

    // Execute pre handlers
    var executeHandlers = function(index, handlers, connection, channel, data, callback) {
      // Return if there are no pre handlers
      if(index == handlers.length) return callback();

      // Execute the next handler
      var handler = handlers.shift();

      // Execute it
      handler(connection, channel, data, function(err) {
        if(err) return callback(err);
        executeHandlers(index++, handlers, connection, channel, data, callback);
      });
    }

    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! server post 1 :: " + url)
    // Register the handler for the REST endpoint
    server.post(url, function(req, res) {
      console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! server post 2")
      // We have no body
      if(!req.body) {
        return res.end(JSON.stringify({
          ok: false, code: ERRORS.TRANSPORT_FAILURE, message: 'no json object passed in body'
        }));
      }

      // Locate a handler by channel, error out if no handler available
      var channelHandler = self.handlers[req.body.channel];
      if(!channelHandler) {
        return res.end(JSON.stringify({
          ok: false, code: ERRORS.NO_CHANNEL_TRANSPORT_FAILURE, message: f('channel [%s] not valid', req.body.channel)
        }));
      }

      // PRE HANDLERS
      executeHandlers(0, channelHandler.pre, self, req.body.channel, req.body.obj, function(err) {
        // Do we have an error
        if(err) {
          return channelHandler.errorHandler(self, req.body.channel, req.body.obj, Array.isArray(err) ? err : [err]);
        }

        // Return a object that allows us to write back in same context
        var connection = {
          write: function(channel, doc) {
            res.send(JSON.stringify({
              channel: channel, obj: doc
            }));
          }
        }

        // Library MongoDB handler
        channelHandler.handler(connection, req.body.channel, req.body.obj);
      });
    });
  }

  write(channel, doc) {
    this.connection.emit(channel, doc);
  }
}

module.exports = Connection;
