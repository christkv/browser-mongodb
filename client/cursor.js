"use strict"

var Promise = require('./util').Promise,
  EventEmitter = require('./event_emitter'),
  co = require('co');

// Contains the global liveQuery id used to associate queries
var liveQueryId = 0;

class Cursor extends EventEmitter {
  constructor(db, collection, query) {
    super();
    this.db = db;
    this.collection = collection;
    this.query = query;

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

  projection(value) {
    this.options.projection = value;
    return this;
  }

  comment(value) {
    this.options.comment = value;
    return this;
  }

  hint(value) {
    this.options.hint = value;
    return this;
  }

  maxTimeMS(value) {
    this.options.maxTimeMS = value;
    return this;
  }

  sort(value) {
    this.options.sort = value;
    return this;
  }

  limit(value) {
    this.options.limit = value;
    return this;
  }

  skip(value) {
    this.options.skip = value;
    return this;
  }

  batchSize(value) {
    this.options.batchSize = value;
    return this;
  }

  noCursorTimeout() {
    this.options.noCursorTimeout = true;
    return this;
  }

  /**
   * Return count of documents
   *
   * @method
   * @return {Cursor} returns Cursor
   */
  liveQuery() {
    // Set the listen flag on the query
    this.options.liveQuery = true;
    this.options.liveQueryId = liveQueryId++;
    // Return the cursor
    return this;
  }

  /**
   * Set up a tailable cursor
   *
   * @method
   * @param {object} doc Document to insert.
   * @param {object} [options=null] Optional settings.
   * @param {boolean} [options.oplogReplay=false] Specify that we wish to use the oplogReply flag.
   * @param {boolean} [options.awaitData=true] Specify that we wish to use the oplogReply flag.
   */
  tailable(options) {
    this.options = Object.assign(this.options, {tailable:true, awaitData:true}, options || {});
    return this;
  }

  //
  // Function implementations
  //

  /**
   * Return count of documents
   *
   * @method
   * @return {Promise} returns Promise
   */
  count() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var r = yield self.db.command(Object.assign({
          count: self.collection.namespace,
          query: self.query
        }), self.options);
      });
    });
  }

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
          var commandOptions = filterOptions(self.options, ['readPreference', 'sort', 'projection'
            , 'hint', 'skip', 'limit', 'batchSize', 'singleBatch', 'comment', 'maxScan', 'maxTimeMS'
            , 'readConcern', 'max', 'min', 'returnKey', 'showRecordId', 'snapshot', 'tailable'
            , 'oplogReply', 'noCursorTimeout', 'awaitData', 'allowPartialResults', "liveQuery", "liveQueryId"]);

          // Execute the find command
          var r = yield self.db.command(Object.assign({
            find: self.collection.namespace,
            filter: self.query
          }, commandOptions), {fullResult:true});

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
        && self.state == 'open' && self.cursorId.isZero()) {

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
          // Create getMore additional options dictionary
          var commandOptions = filterOptions(self.options, ['batchSize', 'maxTimeMS']);

          // Execute the command
          var r = yield self.db.command(Object.assign({
            getMore: self.collection.namespace,
            cursorId: self.cursorId,
            connection: self.connection
          }, commandOptions), {fullResult:true});

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

        // Filter out all command options
        var commandOptions = filterOptions(self.options, ['readPreference', 'sort', 'projection'
          , 'hint', 'skip', 'limit', 'batchSize', 'singleBatch', 'comment', 'maxScan', 'maxTimeMS'
          , 'readConcern', 'max', 'min', 'returnKey', 'showRecordId', 'snapshot', 'tailable'
          , 'oplogReply', 'noCursorTimeout', 'awaitData', 'allowPartialResults', 'liveQuery', "liveQueryId"]);

        // Execute the find command
        var r = yield self.db.command(Object.assign({
          find: self.collection.namespace,
          filter: self.query
        }, commandOptions), {fullResult:true});

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
          // Create getMore additional options dictionary
          var commandOptions = {};
          if(self.options.batchSize) commandOptions.batchSize = self.options.batchSize;
          if(self.options.maxTimeMS) commandOptions.maxTimeMS = self.options.maxAwaitTimeMS;

          // Execute the getMore command
          var r1 = yield self.db.command(Object.assign({
            getMore: self.collection.namespace,
            cursorId: cursorId.toJSON(),
            connection: connection
          }, commandOptions), {fullResult:true});

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

var filterOptions = function(options, fields) {
  var object = {};

  for(var i = 0; i < fields.length; i++) {
    if(options[fields[i]] != null) object[fields[i]] = options[fields[i]];
  }

  return object;
}

module.exports = Cursor;
