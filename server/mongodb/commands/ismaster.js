"use strict"

var co = require('co');

class Command {
  constructor() {
  }

  handle(connection, mongoClient, bson, originalOp, op, liveQueryHandler, options) {
    return new Promise(function(resolve, reject) {
      co(function*() {
        var result = yield mongoClient.command({ismaster:true});
        // Default liveQuery is off
        var liveQuery = false;
        // Did we receive a replicaset ismaster result
        if(result.isreplicaset
          || result.ismaster != null
          || result.secondary != null) {
          liveQuery = true;
        }

        // Return the result
        resolve({
          ok: true, insert:true, update:true, delete:true,
          findAndModify:true, commands: ['ismaster'], liveQuery: liveQuery
        });
      }).catch(reject);
    });
  }
}

module.exports = Command;
