"use strict"

var co = require('co')
  , EJSON = require('mongodb-extended-json')
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
        var parts = op.aggregate.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

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

        // Build the command
        var command = {
          aggregate: collection,
          pipeline: op.pipeline,
        }

        // Add all missing options
        if(op.explain) command.explain = op.explain;
        if(op.allowDiskUse) command.allowDiskUse = op.allowDiskUse;
        if(op.bypassDocumentValidation) command.bypassDocumentValidation = op.bypassDocumentValidation;

        // Always return as cursor
        if(!command.cursor) command.cursor = {}

        // Set a batchSize
        if(op.batchSize) {
          command.cursor.batchSize = op.batchSize;
        }

        // Set a readConcern
        if(op.readConcern && op.readConcern.level) {
          command.readConcern.level = op.readConcern.level;
        }

        // console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^")

        // Execute the command
        var result = yield mongoClient.db(db).command(command, options);

        // console.log("==================================================")
        // console.dir(result)
        // process.exit(0)

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

        // Return response
        resolve({connection: result.hashedName, result: result.documents[0]});
      }).catch(reject);
    });
  }
}

module.exports = Command;
