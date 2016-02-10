"use strict"

var co = require('co')
  , EJSON = require('mongodb-extended-json');

// Used to identify errors in Raw messages
var okFalse = new Buffer([1, 111, 107, 0, 0, 0, 0]);
var okTrue = new Buffer([1, 111, 107, 0, 0, 0, 1]);

class Command {
  constructor() {
  }

  handle(connection, mongoClient, bson, originalOp, op, liveQueryHandler, options) {
    options = options || {};
    if(!options.promoteLong) options.promoteLong = false;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Split the name space
        var parts = op.getMore.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Do we need to pin the command to an operation
        if(op.connection) {
          // Find a connection that can take the getMore
          var connections = mongoClient.serverConfig.connections();
          for(var i = 0; i < connections.length; i++) {
            // Retrieve the server we wish to use
            if(connections[i].hashedName == op.connection) {
              options.connection = connections[i];
              break;
            }
          }
        }

        // Create command
        var command = {
          getMore: op.cursorId, collection: collection
        }
        if(op.batchSize) command.batchSize = op.batchSize;
        if(op.maxTimeMS) command.maxTimeMS = op.maxTimeMS;

        // Get the full result
        options.fullResult = true;

        // Execute the command
        var result = yield mongoClient.db(db).command(command, options);

        // Create extended EJSON if don't have a raw query
        if(!options.raw) {
          result.documents[0] = JSON.parse(EJSON.stringify(result.documents[0]));
        }

        // Check if we have a raw response
        if(options.raw && result.documents[0].slice(0, 64).indexOf(okFalse) != -1) {
          var errorMessage = bson.deserialize(result.documents[0]);
          // Reject the command
          return reject({
            ok:false, code: errorMessage.code, message: errorMessage.errmsg, op: op
          });
        }

        // Return response
        resolve({connection: result.hashedName, result: result.documents[0]});
      }).catch(reject);
    });
  }
}

module.exports = Command;
