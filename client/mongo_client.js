"use strict"

var Promise = require('./util').Promise,
  Callbacks = require('./callbacks'),
  MongoError = require('./mongo_error'),
  Long = require('./bson/long'),
  ObjectId = require('./bson/objectid'),
  co = require('co'),
  Db = require('./db');

var deserialize = function(obj) {
  if(obj != null && typeof obj === 'object') {
    for(var name in obj) {
      if(obj[name]['$numberLong']) {
        obj[name] = Long.fromString(obj[name]['$numberLong']);
      } else if(obj[name]['$oid']) {
        obj[name] = new ObjectId(obj[name]['$oid']);
      } else if(obj[name] != null && typeof obj[name] === 'object') {
        obj[name] = deserialize(obj[name]);
      }
    }
  }

  return obj;
}

class MongoClient {
  constructor(transportFactory) {
    this.transportFactory = transportFactory;
    this.store = new Callbacks();
  }

  connect(url, channel, options) {
    var self = this;
    // Set the options
    this.options = options || {}
    // Use a custom channel or the default one
    this.channel = channel || 'mongodb';

    // Return the promise to allow for the connection
    return new Promise(function(resolve, reject) {
      co(function*() {
        // Save the socket
        self.transport = yield self.transportFactory.connect(url, options);

        // Listen to all mongodb socket information
        self.transport.onChannel(self.channel, function(data) {
          // console.log("\n\n\n!!!!!!!!!!!!!!!!!!!!!!!!! Client received data")
          data = deserialize(data);
          // if(data.r[0] && data.r[0].documents) {
          //   console.dir(deserialize(data.r[0].documents))
          // }
          // console.log(JSON.stringify(data, null, 2))
          // // console.dir(data.r)

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

        self.transport.on('connect', function() {
          co(function*() {
            // Execute ismaster against server to determine abilites available
            self.abilities = yield self.db('admin').command({ismaster:true});
            // Resolve
            resolve(self);
          }).catch(function(err) {
            reject(err);
          });
        });

        self.transport.on('close', function() {
          reject();
        });

        self.transport.on('error', function(e) {
          reject(e);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  db(name) {
    return new Db(name, this.channel, this.transport, this.store);
  }
}

module.exports = MongoClient;
