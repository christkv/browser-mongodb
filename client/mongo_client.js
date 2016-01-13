"use strict"

var Promise = require('./util').Promise,
  Callbacks = require('./callbacks'),
  MongoError = require('./mongo_error'),
  Db = require('./db');

class MongoClient {
  constructor(transport) {
    this.transport = transport;
    this.store = new Callbacks();
  }

  connect(url, channel) {
    var self = this;
    // Use a custom channel or the default one
    this.channel = channel || 'mongodb';

    // Save the socket
    self.socket = this.transport(url);

    // Listen to all mongodb socket information
    self.socket.on(this.channel, function(data) {
      if(data.ok != null && !data.ok) {
        // We got a command error
        self.store.call(data._id, new MongoError(data), undefined);
      } else if(data.ok != null && data.ok && data.change) {
        // We got a message about changes to the results from a query
        self.store.update(data);
      } else if(data.ok != null && data.ok) {
        // Result from a command
        self.store.call(data._id, null, data);
      }
    });

    // Return the promise
    return new Promise(function(resolve, reject) {
      self.socket.on('connect', function() {
        resolve(self);
      });

      self.socket.on('close', function() {
        reject();
      });

      self.socket.on('error', function(e) {
        reject(e);
      });
    });
  }

  db(name) {
    return new Db(name, this.channel, this.socket, this.store);
  }
}

module.exports = MongoClient;
