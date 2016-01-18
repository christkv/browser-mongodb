"use strict"

var Promise = require('./util').Promise,
  nextTick = require('./util').nextTick,
  EventEmitter = require('./event_emitter'),
  co = require('co');

class CommandCursor extends EventEmitter {
  constructor(cmd, db, collection) {
    super();
    this.cmd = cmd;
    this.db = db;
    this.collection = collection;

    // State of the cursor
    this.state = 'init';
    this.documents = [];
    this.cursorId = null;
    // Currently selected document
    this.document = null;
    // The options
    this.options = {};
  }

  //
  // Properties implementation
  //
  setReadPreference(mode, tags) {
    this.options.readPreference = { mode: mode, tags: tags };
    return this;
  }

  maxTimeMS(value) {
    this.options.maxTimeMS = value;
    return this;
  }

  batchSize(value) {
    this.options.batchSize = value;
    return this;
  }

  //
  // Function implementations
  //

  /**
   * Check if cursor contains more documents
   *
   * @method
   * @return {Promise} returns Promise
   */
  hasNext() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        if(self.document) return resolve(true);
        self.document = yield self.next();
        if(self.document == null) return resolve(false);
        resolve(true);
      }).catch(reject);
    });
  }

  /**
   * Get the next document available in the cursor
   *
   * @method
   * @return {Promise} returns Promise
   */
  next() {
    var self = this;

    return new Promise(function(resolve, reject) {
      // User called hasNext, return the existing document first
      if(self.state == 'destroyed') return reject(new Error('cursor exhausted or destroyed'));
      if(self.document) {
        var doc = self.document;
        self.document = null;
        return resolve(doc);
      }

      // We have documents left, resolve the next
      if(self.documents.length > 0) {
        return resolve(self.documents.shift());
      } else if(self.documents.length == 0
        && self.state == 'init') {

        //
        // Cursor was just opened, need to fire FIND command
        co(function*() {
          // Execute the find command
          var r = yield self.db.command(self.cmd, {fullResult:true});

          // Get the connection identifier
          self.connection = r.connection;
          r = r.result;

          // Add the documents to the end
          self.documents = self.documents.concat(r.cursor.firstBatch);
          self.cursorId = r.cursor.id;

          // Are we listening
          if(self.options.listen && self.cursorId != null) {
            self.db.store.listen(self);
          }

          // Return the first document
          var doc = self.documents.shift();
          // We have no results
          if(doc === undefined) {
            self.state = 'destroyed';
            return resolve(null);
          }

          // Set the state to open
          self.state = 'open';
          // Return the document
          resolve(doc);
        }).catch(reject);
      } else if(self.documents.length == 0
        && self.state == 'open' && self.cursorId == null) {

        //
        // Cursor is dead
        self.state = 'destroyed';
        resolve(null);
      } else if(self.documents.length == 0
        && self.state == 'open') {

        // Cursor id === 0 and no documents left === exhausted cursor.
        if(self.cursorId.isZero()) {
          self.state = 'destroyed';
          return resolve(null);
        }

        //
        // Cursor was is open, need to fire GETMORE command
        co(function*() {
          var r = yield self.db.command({
            getMore: self.collection.namespace,
            cursorId: self.cursorId,
            connection: self.connection
          }, {fullResult:true});

          // Get the connection identifier
          self.connection = r.connection;
          r = r.result;

          // Add the documents to the end
          self.documents = self.documents.concat(r.cursor.nextBatch);
          self.cursorId = r.cursor.id;
          // Return the first document
          var doc = self.documents.shift();
          // We have no results
          if(doc == undefined) {
            self.state = 'destroyed';
            return resolve(null);
          }

          // Return the document
          resolve(doc);
        }).catch(reject);
      }
    });
  }

  /**
   * Get all documents in the cursor.
   *
   * @method
   * @return {Promise} returns Promise
   */
  toArray() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var docs = [];

        // Execute the find command
        var r = yield self.db.command(self.cmd, {fullResult:true});

        // Get the connection identifier
        var connection = r.connection;
        r = r.result;

        // Get the documents, server format or API format
        docs = docs.concat(r.cursor.firstBatch);
        var cursorId = r.cursor.id;
        // No more documents
        if(cursorId.isZero()) return resolve(docs);

        // Execute getMore's until we are done
        while(true) {
          var r1 = yield self.db.command({
            getMore: self.collection.namespace,
            cursorId: cursorId.toJSON(),
            connection: connection
          }, {fullResult:true});

          // Get the connection identifier
          var connection = r1.connection;
          r1 = r1.result;

          // Get the documents, server format or API format
          docs = docs.concat(r1.cursor.nextBatch);
          var cursorId = r1.cursor.id;

          // Get the documents
          if(cursorId.isZero()) break;
        }

        // Return the document
        resolve(docs);
      }).catch(reject);
    });
  }

  /**
   * Destroy the cursor.
   *
   * @method
   * @return {Promise} returns Promise
   */
  destroy() {
    var self = this;

    return new Promise(function(resolve, reject) {
      if(self.cursorId == null) return resolve();

      //
      // Cursor is open, need to fire KILLCURSOR command
      co(function*() {
        var r = yield self.db.command({
          killCursors: [self.cursorId]
        });

        resolve();
      }).catch(reject);
    });
  }
}

module.exports = CommandCursor;
