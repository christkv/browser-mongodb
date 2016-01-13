"use strict"

var Collection = require('./collection');

class Db {
  constructor(name, channel, socket, store) {
    this.name = name;
    this.channel = channel;
    this.socket = socket;
    this.store = store;
  }

  collection(name) {
    return new Collection(name, this);
  }

  //
  // Supports one or more operations, allowing for batching up
  // of command to save on round-trips to the server
  command(ops, options) {
    var self = this;
    options = options || {};

    // Ensure operations sent over the transport is an array
    ops = ops != null && typeof ops == 'object' ? [ops] : ops;

    // Return the promise
    return new Promise(function(resolve, reject) {
      // Final batch op sent to the server
      var op = {
        _id: self.store.id(),
        ops: ops,
        ordered: typeof options.ordered == 'boolean'
          ? options.ordered : true
      };

      // Add a listener to the store
      self.store.add(op._id, function(err, result) {
        if(err) return reject(err);
        if(ops.length == 1) return resolve(result.r[0]);
        resolve(result);
      });

      // Write the operation out on the socket (with a group id)
      self.socket.emit(self.channel, op);
    });
  }
}

module.exports = Db;
