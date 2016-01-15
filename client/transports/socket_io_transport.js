"use strict"

var Promise = require('../util').Promise,
  EventEmitter = require('../event_emitter');

class Connection extends EventEmitter {
  constructor(socket) {
    super();
    var self = this;
    this.socket = socket;

    self.socket.on('connect', function(s) {
      self.emit('connect');
    });

    self.socket.on('connect_error', function(err) {
      self.emit('error', err);
    });
  }

  onChannel(channel, callback) {
    this.socket.on(channel, callback);
  }

  write(channel, obj) {
    this.socket.emit(channel, obj);
  }
}

class SocketIOTransport {
  constructor(ioClientConnect, options) {
    this.ioClientConnect = ioClientConnect;
    this.options = options || {};
    this.socket = null;
  }

  connect(url, options) {
    var self = this;

    return new Promise(function(resolve, reject) {
      try {
        // Create connection
        self.socket = self.ioClientConnect(url);
        // Return the connection wrapper (keep unified API across transports)
        resolve(new Connection(self.socket));
      } catch(err) {
        reject(err);
      }
    });
  }

  on() {
  }

  emit() {
  }
}

module.exports = SocketIOTransport;
