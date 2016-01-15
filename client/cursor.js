"use strict"

var Promise = require('./util').Promise,
  nextTick = require('./util').nextTick,
  EventEmitter = require('./event_emitter'),
  co = require('co');

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
  }

  /**
   * Return count of documents
   *
   * @method
   * @return {Cursor} returns Cursor
   */
  listen() {
    // Set the listen flag on the query
    this.options.listen = true;
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
   * @param {number} [options.maxAwaitTimeMS] Specify the amount of time to wait before closing tailing cursor (only applies to MongoDB 3.2 or higher).
   */
  tailable(options) {
    this.options = Object.assign(this.options, {tailable:true}, options || {});
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
      });
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
          var r = yield self.db.command({
            find: self.collection.namespace,
            filter: self.query
          });

          // Add the documents to the end
          self.documents = self.documents.concat(r.documents);
          self.cursorId = r.cursorId;

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

        //
        // Cursor was is open, need to fire GETMORE command
        co(function*() {
          var r = yield self.db.command({
            getMore: self.collection.namespace,
            cursorId: self.cursorId
          });

          // Add the documents to the end
          self.documents = self.documents.concat(r.documents);
          self.cursorId = r.cursorId;
          // Return the first document
          var doc = self.documents.shift();
          // We have no results
          if(doc === undefined) {
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
        var r = yield self.db.command({
          find: self.collection.namespace,
          filter: self.query
        });

        // Get the documents
        docs = docs.concat(r.documents);
        if(r.cursorId.isZero()) return resolve(docs);

        // Execute getMore's until we are done
        while(true) {
          var r1 = yield self.db.command({
            getMore: self.collection.namespace,
            cursorId: r.cursorId.toJSON()
          });

          // Get the documents
          docs = docs.concat(r1.documents);
          if(r1.cursorId.isZero()) break;
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

module.exports = Cursor;
