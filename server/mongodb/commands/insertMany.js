"use strict"

var co = require('co')
  , EJSON = require('mongodb-extended-json');

class Command {
  constructor() {
  }

  handle(connection, mongoClient, bson, originalOp, op, liveQueryHandler, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Split the name space
        var parts = op.insertMany.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Merge the ops
        var commandOptions = {}
        if(op.ordered) commandOptions.ordered = op.ordered;
        if(op.bypassDocumentValidation) commandOptions.bypassDocumentValidation = op.bypassDocumentValidation;
        if(op.w) commandOptions.w = op.w;
        if(op.wtimeout) commandOptions.wtimeout = op.wtimeout;
        if(op.j) commandOptions.j = op.j;

        // Return full results
        commandOptions.fullResult = true;

        // Function to execute
        var result = yield mongoClient.db(db).collection(collection).insertMany(EJSON.deserialize(op.docs), commandOptions);

        // Final result
        var finalResult = {
          insertedCount: result.insertedCount,
        };

        // Merge in the inserted ids
        finalResult.insertedIds = result.insertedIds;

        // Return the result;
        resolve(finalResult);
      }).catch(reject);
    });
  }
}

module.exports = Command;
