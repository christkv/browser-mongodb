"use strict"

var co = require('co'), 
  Timestamp = require('mongodb').Timestamp,
  Long = require('mongodb').Long,
  listener = require('mongodb').instrument();

class LiveQuery {
  constructor(namespace, id, connection, cmd) {
    this.namespace = namespace;
    this.id = id;
    this.connection = connection;
    this.filter = cmd;
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
    // Do we have any live queries
    if(this.liveQueries[namespace]) {
      // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@ found live queries")
    }
  }

  // We got an update
  update(namespace, doc) {
    var self = this;

    // Do we have any live queries
    if(this.liveQueries[namespace]) {
      // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@ found live queries")
      // console.dir(this.liveQueries[namespace])
      // console.dir(doc)
      var queries = this.liveQueries[namespace];

      // Iterate over all available queries
      for(var i = 0; i < queries.length; i++) {
        var query = queries[i];
        var filter = query.filter;
        var match = false;

          // console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ WRITE MATCH query:: "+ match)
        // console.dir(query)

        // Iterate over all the fields in the filter
        for(var name in filter) {
          console.log(doc[name] + " = " + filter[name])
          if(doc[name] == filter[name]) {
            match = true;
            break;
          }
        }

          // console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ WRITE MATCH :: "+ match)

        // We have a match, let's fire off the change message
        if(match) {
          // console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ WRITE")
          query.connection.write(self.channel, {
            type: 'changed',
            namespace: query.namespace,
            cursorId: query.id,
            doc: doc
          });
        }
      }
    }
  }

  // We got an update
  delete(namespace, doc) {

  }

  // dispatch
  dispatch(op) {
    var self = this;

    co(function*() {
      // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! dispatch")
      // console.dir(op)
      var namespace = op.ns;
      var oplogVersion = op.v;
      var operationType = op.op;
      var object1 = op.o;
      var object2 = op.o2;

      // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! dispatch 1")
      // Split up the namespace
      var parts = namespace.split('.');
      var db = parts.shift();
      var collection = parts.join('.');
      // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! dispatch 2 :: " + operationType)

      // Insert operation
      if(operationType == 'i') {
        // console.log("-------------------------------- INSERT")

      } else if(operationType == 'u') {
        // console.log("-------------------------------- UPDATE")
        // console.log(db)
        // console.log(collection)
        // console.dir(object2._id)
        // Update operation, we need to fetch the whole document as we
        // don't have enough fields to perform an evaluation
        var doc = yield self.client.db(db).collection(collection).findOne({_id: object2._id});
        // console.log("-------------------------------- UPDATE 2")
        // Match the document with the current live queries
        self.update(namespace, doc);
      } else if(operationType == 'd') {
      // Delete operation
        // console.log("-------------------------------- DELETE")

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
    // console.log("####################################### 0 LiveQueryHandler connect")

    // Add a handler
    listener.on('succeeded', function(event) {
      // Do we have a write operation
      if(event.commandName == 'insert'
        || event.commandName == 'update'
        || event.commandName == 'delete') {
        // console.log("APM -- write operation")
        // console.dir(event.reply)

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
      } else if(event.commandName == 'ismaster') {
        // console.log("APM -- ismaster")
        // console.dir(event)
      }
    });

    // Connect to the upload
    var connectToOplog = function(self) {     
      co(function*() {
        // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% connectToOplog")
        // console.dir({ts: {$gte: self.lastKnownOpTime.ts }})
        // console.dir(self.options)
        // var docs = yield self.client.db('local').collection('oplog.rs').find({ts: {$gte: self.lastKnownOpTime.ts }}).toArray();
        // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ TRY")
        // console.dir(docs)

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
          // console.log("@@@@@@@@@@@@@@@@@@ DATA")
          // console.dir(data)
          // Store last Known opTime for reconnects
          self.lastKnownOpTime = {ts: data.ts, t: data.t};
          // Reset back off time
          self.currentBackOffMS = self.options.initialBackOffMS;
          // We will now process the actual operation
          self.dispatcher.dispatch(data);
        });

        // Handle oplog errors
        self.cursor.on('error', function(err) {
          // console.log("@@@@@@@@@@@@@@@@@@ ERROR")
          // console.dir(err)
        });

        self.cursor.on('end', function() {
            // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@ END 0")
          setTimeout(function() {
            // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@ END 1")
            self.currentBackOffMS = self.currentBackOffMS * 2;

            // Reset the back off
            if(self.currentBackOffMS > self.options.maxBackOffMS) {
              self.currentBackOffMS = self.options.initialBackOffMS;
            }
            // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@ END 2 :: " + self.currentBackOffMS)

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

        // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ GET FIRST")
        // console.dir(self.lastKnownOpTime)
        // Initiate the cursor
        connectToOplog(self);
        // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ GET FIRST")
        // Set to running
        self.state = 'running';
        // Resolve
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = LiveQueryHandler;