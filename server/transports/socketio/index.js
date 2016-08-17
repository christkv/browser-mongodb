"use strict"

var EventEmitter = require('events').EventEmitter,
  Connection = require('./connection');

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
