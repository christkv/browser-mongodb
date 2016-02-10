"use strict"

var co = require('co')
  , EJSON = require('mongodb-extended-json')
  , ERRORS = require('../errors');

class Command {
  constructor() {
  }

  handle(connection, mongoClient, bson, originalOp, op, liveQueryHandler, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Split the name space
        var parts = op.replaceOne.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Unpack the command
        var query = op.q;
        var update = op.u;

        // Validate the update
        for(var name in update) {
          if(name[0] == '$') return reject({
            ok:false, code: ERRORS.REPLACE_CONTAINS_OPERATORS, message: 'replace document contains operators'
          });
        }

        // Merge the ops
        var commandOptions = {}
        if(op.upsert) commandOptions.upsert = op.upsert;
        if(op.bypassDocumentValidation) commandOptions.bypassDocumentValidation = op.bypassDocumentValidation;
        if(op.w) commandOptions.w = op.w;
        if(op.wtimeout) commandOptions.wtimeout = op.wtimeout;
        if(op.j) commandOptions.j = op.j;

        // Return full results
        commandOptions.fullResult = true;

        // Function to execute
        var result = yield mongoClient.db(db).collection(collection).replaceOne(query, update, commandOptions);

        // Final result
        var finalResult = {
          matchedCount: result.matchedCount,
          upsertedCount: result.upsertedCount, modifiedCount:result.modifiedCount
        };

        if(result.upsertedId) finalResult.upsertedId = result.upsertedId;

        // Return the result;
        resolve(finalResult);
      }).catch(reject);
    });
  }
}

module.exports = Command;
