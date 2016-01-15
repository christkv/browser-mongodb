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

      // Write the operation out on the transport (with a group id)
      self.transport.write(self.channel, op);
    });
  }
}

module.exports = Db;
