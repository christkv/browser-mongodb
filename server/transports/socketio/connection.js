"use strict"

var EventEmitter = require('events').EventEmitter;

// Connection Id
var id = 0;

class Connection extends EventEmitter {
  constructor(connection, handlers) {
    super();
    var self = this;
    this.handlers = handlers;
    this.connection = connection;
    this.id = (id++) % Number.MAX_VALUE;

    // Execute pre handlers
    var executeHandlers = function(index, handlers, connection, channel, data, callback) {
      // No handlers, return
      if(handlers.length == 0) return callback();
      // Return if there are no pre handlers
      if(index == handlers.length) return callback();
      // Get the next handler
      var handler = handlers[index];
      // Execute it
      handler(connection, channel, data, function(err) {
        if(err) return callback(err);
        // Update index into handlers
        index = index + 1;
        // Call execute handlers again
        executeHandlers(index, handlers, connection, channel, data, callback);
      });
    }

    // Register the handler
    var registerHandler = function(channel, channelHandler) {
      connection.on(channel, function(data) {
        // PRE HANDLERS
        executeHandlers(0, channelHandler.pre, self, channel, data, function(err) {
          // Do we have an error
          if(err) {
            return channelHandler.errorHandler(self, channel, data, Array.isArray(err) ? err : [err]);
          }

          // Library MongoDB handler
          channelHandler.handler(self, channel, data);
        });
      });
    }

    // Add listeners to the connection
    for(var channel in handlers) {
      registerHandler(channel, handlers[channel]);
    }
  }

  session() {
    return this.connection.handshake.session;
  }

  write(channel, doc) {
    this.connection.emit(channel, doc);
  }
}

module.exports = Connection;