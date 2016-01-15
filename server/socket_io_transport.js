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

    // Register the handler
    var registerHandler = function(channel, channelHandler) {
      connection.on(channel, function(data) {
        // PRE HANDLERS

        // Library MongoDB handler
        channelHandler.handler(self, channel, data);

        // POST HANDLERS

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
