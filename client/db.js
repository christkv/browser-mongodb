"use strict"

var Collection = require('./collection');

class Db {
  constructor(name, channel, transport, store) {
    this.name = name;
    this.channel = channel;
    this.transport = transport;
    this.store = store;
  }

  collection(name) {
    return new Collection(name, this);
  }

  //
  // Supports one or more operations, allowing for batching up
  // of command to save on round-trips to the server
  command(op, options) {
    var self = this;
    options = options || {};

    // Return the promise
    return new Promise(function(resolve, reject) {
      // Final batch op sent to the server
      var cmd = {
        _id: self.store.id(),
        op: op
      };

      // Add a listener to the store
      self.store.add(cmd._id, function(err, result) {
        if(err) return reject(err);
        resolve(options.fullResult ? result : result.result);
      });

      // Write the operation out on the transport (with a group id)
      self.transport.write(self.channel, cmd);
    });
  }
}

module.exports = Db;
