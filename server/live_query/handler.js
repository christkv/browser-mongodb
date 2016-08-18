"use strict"

var co = require('co'),
  Timestamp = require('mongodb').Timestamp,
  Long = require('mongodb').Long,
  Dispatcher = require('./dispatcher'),
  listener = require('mongodb').instrument();

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

    // Create successhandler
    this.successHandler = new createEventHandler(this);
  }

  register(connection, ns, liveQueryId, op) {
    this.dispatcher.register(connection, ns, liveQueryId, op);
  }

  destroy() {
    // Remove any listeners
    listener.removeListener('succeeded', this.successHandler);
    // Destroy the cursor
    this.cursor.destroy();
  }

  connect() {
    var self = this;

    // Remove any listeners
    listener.removeListener('succeeded', self.successHandler);

    // Add a handler
    listener.on('succeeded', self.successHandler);

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

// Create event handler
var createEventHandler = function(self) {
  return function(event) {
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
  }
}

// Connect to the oplog
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

module.exports = LiveQueryHandler;
