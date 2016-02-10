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
        var parts = op.findOneAndDelete.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Return full results
        op.fullResult = true;

        // Function to execute
        var result = yield mongoClient.db(db).collection(collection).findOneAndDelete(op.q, op);
        // Return the result;
        resolve(result.documents[0].value);
      }).catch(reject);
    });
  }
}

module.exports = Command;
