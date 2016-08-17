"use strict"

var EventEmitter = require('events').EventEmitter,
  Connection = require('./connection');

class Transport extends EventEmitter {
  constructor(url, server) {
    super();
    var self = this;

    // Contains all the channel handlers
    this.handlers = {};

    // Emit a new connection
    self.emit('connection', new Connection(url, server, self.handlers));
  }

  channel(handler) {
    this.handlers[handler.channel] = handler;
  }
}

module.exports = Transport;
