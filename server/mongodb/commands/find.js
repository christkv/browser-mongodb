"use strict"

var co = require('co')
  , EJSON = require('mongodb-extended-json')
  , ReadPreference = require('mongodb').ReadPreference
  , ERRORS = require('../errors')
  , okFalse = require('../util').okFalse;

class Command {
  constructor() {
  }

  handle(connection, mongoClient, bson, originalOp, op, liveQueryHandler, options) {
    options = options || {};
    if(!options.promoteLongs) options.promoteLongs = false;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Split the name space
        var ns = op.find;
        var parts = op.find.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Do we have a live query
        var liveQuery = op.liveQuery || false;
        var liveQueryId = op.liveQueryId;
        // Remove the fields not compatible with the find command
        delete op['liveQuery'];
        delete op['liveQueryId'];

        // If we don't have a liveQueryId error out
        if(liveQuery && typeof liveQueryId != 'number') {
          return reject({
            ok:false, code: ERRORS.LIVE_QUERY_ID_ILLEGAL, message: 'liveQueryId not provided or not an integer', op: op
          });
        }

        // If we don't have a liveQueryId error out
        if(liveQuery && liveQueryHandler == null) {
          return reject({
            ok:false, code: ERRORS.NO_LIVE_QUERY_CHANNEL_HANDLER, message: 'no liveQuery channel handler registered', op: op
          });
        }

        // Do we have a read Preference specified
        if(op.readPreference) {
          options.readPreference = new ReadPreference(op.readPreference.mode, op.readPreference.tags);
          delete op.readPreference;
        }

        // No pomoteLong set then default to false
        if(options.promoteLongs == null) {
          options.promoteLongs = true;
        }

        // Get the full result
        options.fullResult = true;

        // Execute the command
        var result = yield mongoClient.db(db).command(Object.assign(op, {
          find: collection
        }), options);

        // Check if we have a raw response
        if(options.raw && result.documents[0].slice(0, 64).indexOf(okFalse) != -1) {
          var errorMessage = bson.deserialize(result.documents[0]);
          // Reject the command
          return reject({
            ok:false, code: errorMessage.code, message: errorMessage.errmsg, op: op
          });
        }

        // Create extended EJSON if don't have a raw query
        if(!options.raw) {
          result.documents[0] = JSON.parse(EJSON.stringify(result.documents[0]));
        }

        // Register the live query
        if(liveQuery) {
          liveQueryHandler.register(connection, ns, liveQueryId, originalOp);
        }

        // Return response
        resolve({connection: result.hashedName, result: result.documents[0]});
      }).catch(reject);
    });
  }
}

module.exports = Command;
