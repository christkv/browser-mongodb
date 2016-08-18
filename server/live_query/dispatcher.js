"use strict"

var co = require('co'),
  LiveQuery = require('./query'),
  EJSON = require('mongodb-extended-json');

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

        // Get match result
        var result = filter.documentMatches(doc).result;
        // We have a match, let's fire off the change message
        if(result) {
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

module.exports = Dispatcher;
