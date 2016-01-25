"use strict"

var co = require('co'),
  Timestamp = require('mongodb').Timestamp,
  Long = require('mongodb').Long,
  crypto = require('crypto'),
  EJSON = require('mongodb-extended-json'),
  Matcher = require('./mongodb/matcher'),
  listener = require('mongodb').instrument();

class LiveQuery {
  constructor(namespace, id, connection, filter) {
    this.namespace = namespace;
    this.id = id;
    this.connection = connection;
    this.filter = new Matcher(filter);
  }
}

class Dispatcher {
  // Live queries, split by the name spaces
  constructor(channel, client) {
    this.channel = channel;
    this.client = client;
    this.liveQueries = {};
  }

  // Register
  register(connection, ns, liveQueryId, op) {
    var self = this;

    // Connection closed perform clean up of live queries
    connection.on('close', function() {
      // Remove the query
      if(self.liveQueries[ns]) {
        var queries = self.liveQueries[ns];

        for(var i = 0; i < queries.length; i++) {
          var query = queries[i];

          // Remove the instance from the list of live queries
          if(query.connection === connection && query.id === liveQueryId) {
            // Remove the live query from the list of queries
            queries.splice(i, 1);
            break;
          }
        }
      }
    });

    // Register the connection to our available live queries
    if(this.liveQueries[ns] == null) this.liveQueries[ns] = [];
    // Add a new live query
    this.liveQueries[ns].push(new LiveQuery(ns, liveQueryId, connection, op.filter));
  }

  // We got an update
  insert(namespace, doc) {
    var self = this;

    // Do we have any live queries
    if(this.liveQueries[namespace]) {
      var queries = this.liveQueries[namespace];

      // Iterate over all available queries
      for(var i = 0; i < queries.length; i++) {
        var query = queries[i];
        var filter = query.filter;

        // Turn document into EJSON for the matching
        doc = EJSON.serialize(doc);

        // We have a match, let's fire off the change message
        if(filter.documentMatches(doc)) {
          query.connection.write(self.channel, {
            ok: true,
            type: 'added',
            namespace: query.namespace,
            id: query.id,
            doc: doc._id,
            fields: doc
          });
        }
      }
    }
  }

  // We got an update
  update(namespace, doc, fields) {
    var self = this;

    // Do we have any live queries
    if(this.liveQueries[namespace]) {
      var queries = this.liveQueries[namespace];

      // Iterate over all available queries
      for(var i = 0; i < queries.length; i++) {
        var query = queries[i];
        var filter = query.filter;

        // Turn document into EJSON for the matching
        doc = EJSON.serialize(doc);

        // We have a match, let's fire off the change message
        if(filter.documentMatches(doc)) {
          query.connection.write(self.channel, {
            ok: true,
            type: 'changed',
            namespace: query.namespace,
            id: query.id,
            doc: doc._id,
            fields: fields
          });
        }
      }
    }
  }

  // We got an update
  delete(namespace, doc) {
    var self = this;

    // Do we have any live queries
    if(this.liveQueries[namespace]) {
      var queries = this.liveQueries[namespace];

      // Iterate over all available queries
      for(var i = 0; i < queries.length; i++) {
        var query = queries[i];
        var filter = query.filter;

        // Turn document into EJSON for the matching
        doc = EJSON.serialize(doc);

        // We have a match, let's fire off the change message
        if(filter.documentMatches(doc)) {
          query.connection.write(self.channel, {
            ok: true,
            type: 'removed',
            namespace: query.namespace,
            id: query.id,
            doc: doc._id
          });
        }
      }
    }
  }

  // dispatch
  dispatch(op) {
    var self = this;

    co(function*() {
      var namespace = op.ns;
      var oplogVersion = op.v;
      var operationType = op.op;
      var object1 = op.o;
      var object2 = op.o2;

      // Split up the namespace
      var parts = namespace.split('.');
      var db = parts.shift();
      var collection = parts.join('.');

      // Insert operation
      if(operationType == 'i') {
        self.insert(namespace, op.o);
      } else if(operationType == 'u') {
        // Update operation, we need to fetch the whole document as we
        // don't have enough fields to perform an evaluation
        var doc = yield self.client.db(db).collection(collection).findOne({_id: object2._id});
        // Match the document with the current live queries
        self.update(namespace, doc, op.o);
      } else if(operationType == 'd') {
        self.delete(namespace, op.o);
      }
    }).catch(function(err) {
      console.log(err.stack)
    });
  }
}

class LiveQueryHandler {
  constructor(channel, client, options) {
    this.client = client;
    this.options = options || {};
    this.local = null;
    this.cursor = null;
    this.channel = channel;

    // Tracked op log times
    this.lastKnownOpTime = null;
    this.lastKnownOpWriteTime = null;

    // State of live query handler
    this.state = 'stopped';

    // Default values if not set
    if(!this.options.maxAwaitTimeMS) this.options.maxAwaitTimeMS = 3000;
    if(!this.options.maxTimeMS) this.options.maxTimeMS = 10000;
    if(!this.options.maxBackOffMS) this.options.maxBackOffMS = 10000;
    if(!this.options.initialBackOffMS) this.options.initialBackOffMS = 100;

    // Current backOffMS
    this.currentBackOffMS = this.options.initialBackOffMS;

    // Get the local db
    this.collection = this.client.db('local').collection('oplog.rs');

    // Contains the data
    this.dispatcher = new Dispatcher(channel, this.client);
  }

  register(connection, ns, liveQueryId, op) {
    this.dispatcher.register(connection, ns, liveQueryId, op);
  }

  connect() {
    var self = this;

    // Add a handler
    listener.on('succeeded', function(event) {
      // Do we have a write operation
      if(event.commandName == 'insert'
        || event.commandName == 'update'
        || event.commandName == 'delete') {

        if(event.reply.opTime) {
          var opTime = event.reply.opTime;
          var lastOpTS = null;
          var lastOpT = null;

          // Existing TS
          if(self.lastKnownOpWriteTime) {
            lastOpTS = typeof self.lastKnownOpWriteTime.ts == 'number'
              ? Long.fromNumber(self.lastKnownOpWriteTime.ts) : self.lastKnownOpWriteTime.ts;
            lastOpT = typeof self.lastKnownOpWriteTime.t == 'number'
              ? Long.fromNumber(self.lastKnownOpWriteTime.t) : self.lastKnownOpWriteTime.t;
          }

          // Current OpTime TS
          var opTimeTS = typeof opTime.ts == 'number'
            ? Long.fromNumber(opTime.ts) : opTime.ts;
          var opTimeT = typeof opTime.t == 'number'
            ? Long.fromNumber(opTime.t) : opTime.t;

          // Compare the opTime's
          if(self.lastKnownOpWriteTime == null) {
            self.lastKnownOpWriteTime = opTime;
          } else if(opTimeTS.greaterThan(lastOpTS)) {
            self.lastKnownOpWriteTime = opTime;
          } else if(opTimeTS.equals(lastOpTS)) {
            if(opTimeT.greaterThan(lastOpT)) {
              self.lastKnownOpWriteTime = opTime;
            }
          }
        }
      }
    });

    // Connect to the upload
    var connectToOplog = function(self) {
      co(function*() {
        // Execute the initial oplog query
        self.cursor = self.collection.find({ts: {$gt: self.lastKnownOpTime.ts }})
            .sort({$natural: 1})
            .addCursorFlag('oplogReplay', true)
            .addCursorFlag('noCursorTimeout', true)
            .setCursorOption('numberOfRetries', 0)
            .addCursorFlag('tailable', true)
            .addCursorFlag('awaitData', true)
            .maxAwaitTimeMS(self.options.maxAwaitTimeMS)
            .maxTimeMS(self.options.maxTimeMS);

        // Handle oplog entries
        self.cursor.on('data', function(data) {
          // Store last Known opTime for reconnects
          self.lastKnownOpTime = {ts: data.ts, t: data.t};
          // Reset back off time
          self.currentBackOffMS = self.options.initialBackOffMS;
          // We will now process the actual operation
          self.dispatcher.dispatch(data);
        });

        // Handle oplog errors
        self.cursor.on('error', function(err) {
        });

        self.cursor.on('end', function() {
          setTimeout(function() {
            self.currentBackOffMS = self.currentBackOffMS * 2;

            // Reset the back off
            if(self.currentBackOffMS > self.options.maxBackOffMS) {
              self.currentBackOffMS = self.options.initialBackOffMS;
            }

            connectToOplog(self);
          }, self.currentBackOffMS);
        });
      })
    }

    // Return the promise
    return new Promise(function(resolve, reject) {
      co(function*() {
        var docs = yield self.client.db('local').collection('oplog.rs').find().toArray();
        // Get the first time stamp
        var result = yield self.collection.find({})
          .project({ts:1, t:1}).sort({$natural:1}).limit(1).next();
        // Get the timestamp
        self.lastKnownOpTime = result == null ? {
          ts: Timestamp.fromNumber(1), t: 1
        } : result;

        // Initiate the cursor
        connectToOplog(self);
        // Set to running
        self.state = 'running';
        // Resolve
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = LiveQueryHandler;
