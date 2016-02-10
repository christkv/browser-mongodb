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

  write(channel, doc) {
    this.connection.emit(channel, doc);
  }
}

class SocketIOTransport extends EventEmitter {
  constructor(server) {
    super();
    var self = this;
    // Contains all the channel handlers
    this.handlers = {};

    // Create the Socket.IO
    this.io = require('socket.io')(server);

    // Socket up and running
    this.io.on('connect', function( ){
      self.emit('connect', self);
    });

    // Socket up and running
    this.io.on('disconnect', function( ){
      self.emit('disconnect', self);
    });

    // Add connect
    this.io.on('connection', function(socket) {
      self.emit('connection', new Connection(socket, self.handlers));
    });
  }

  channel(handler) {
    this.handlers[handler.channel] = handler;
  }
}

module.exports = SocketIOTransport;
