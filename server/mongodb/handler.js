"use strict"

var co = require('co'),
  f = require('util').format,
  fs = require('fs'),
  ReadPreference = require('mongodb').ReadPreference,
  Long = require('mongodb').Long,
  ObjectId = require('mongodb').ObjectId,
  Binary = require('mongodb').Binary,
  Timestamp = require('mongodb').Timestamp,
  EJSON = require('mongodb-extended-json'),
  Compiler = new require('vitesse-jsonspec');

// Read and compile all the json schemas
var createValidators = function(validators) {
  var object = {};
  var compiler = new Compiler();
  // For each of the validators compile them
  validators.forEach(function(x) {
    var schema = JSON.parse(fs.readFileSync(f('%s/schemas/%s', __dirname, x.json), 'utf8'));
    compiler.compile(schema, {closure:false}, function(err, validator) {
      object[x.command] = validator;
    });
  });

  // Return the validators
  return object;
}

// Create all the validators
var validators = createValidators([{
  command: 'find', json: 'find_command.json'
}, {
  command: 'getMore', json: 'get_more_command.json'
}]);

class ChannelHandler {
  constructor(client) {
    this.client = client;
  }

  handle(connection, channel, doc) {
    var self = this;

    co(function*() {
      // console.log("- handle wire message -")
      var left = doc.ops.length;
      var promises = [];

      // Process all the operations
      for(var i = 0; i < doc.ops.length; i++) {
        var op = doc.ops[i];

        if(op.ismaster) {
          promises.push(self.ismaster(op));
        } else if(op.insertOne) {
          promises.push(self.insertOne(op));
        } else if(op.insertMany) {
          promises.push(self.insertMany(op));
        } else if(op.find) {
          promises.push(self.find(op));
        } else if(op.getMore) {
          promises.push(self.getMore(op));
        } else {
          // We have an unsuported protocol message
          return connection.write({
            ok: false, _id: doc._id
          });
        }
      }

      // Resolve all the promises
      var results = yield Promise.all(promises);
      // Write the content out
      connection.write(channel, {
        ok:true, _id: doc._id, r: results
      })
    }).catch(function(err) {
      // Add the doc._id
      err._id = doc._id;
      // Write the error
      connection.write(channel, err);
    });
  }

  find(op) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ FIND COMMAND")
        // console.dir(op)
        // Perform the validation
        var results = validators.find.validate(op);
        // console.dir(results)
        if(results.length > 0) {
          return reject({
            ok:false, code: 0, command: 'find', message: 'command failed validation'
          });
        }

        // Split the name space
        var parts = op.find.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Additional options
        var options = {}

        // Do we have a read Preference specified
        if(op.readPreference) {
          options.readPreference = new ReadPreference(op.readPreference.mode, op.readPreference.tags);
          delete op.readPreference;
        }

        // Additional options
        var options = {promoteLong:false}

        // Get the collection
        var result = yield self.client.db(db).command(Object.assign(op, {
          find: collection
        }), options);

        // Create extended EJSON
        result = JSON.parse(EJSON.stringify(result));

        // Return response
        resolve({
          ok:true, cursorId: result.cursor.id, documents: result.cursor.firstBatch
        });
      }).catch(reject);
    });
  }

  getMore(op) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ GETMORE COMMAND")
        // Perform the validation
        var results = validators.getMore.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: 0, command: 'find', message: 'command failed validation'
          });
        }

        // Ensure we have valid object
        op = EJSON.deserialize(op);

        // Split the name space
        var parts = op.getMore.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Additional options
        var options = {}
        // Create command
        var command = {
          getMore: op.cursorId, collection: collection
        }
        if(op.batchSize) command.batchSize = op.batchSize;
        if(op.maxTimeMS) command.maxTimeMS = op.maxTimeMS;
        // Get the collection
        var result = yield self.client.db(db).command(command);
        // Create extended EJSON
        result = JSON.parse(EJSON.stringify({
          ok:true, cursorId: result.cursor.id, documents: result.cursor.nextBatch
        }));
        // Return response
        resolve(result);
      }).catch(reject);
    });
  }

  ismaster(doc) {
    return new Promise(function(resolve, reject) {
      resolve({
        ok: true, insert:true, update:true, delete:true,
        findAndModify:true, commands: ['ismaster'], listen: true
      })
    });
  }

  insertOne(op) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Split the name space
        var parts = op.ns.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Merge supported options
        var options = mergeOptions(op.insertOne);
        // Get the collection
        var result = yield self.client.db(db).collection(collection).insertOne(op.insertOne.doc, options);
        // Return response
        resolve({
          ok:true, insertedCount: result.insertedCount, insertedIds: [result.insertedId]
        });
      }).catch(reject);
    });
  }

  insertMany(op) {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Split the name space
        var parts = op.ns.split('.');
        var db = parts.shift();
        var collection = parts.join('.');
        // Merge supported options
        var options = mergeOptions(op.insertMany);
        // Get the collection
        var result = yield self.client.db(db).collection(collection).insertMany(op.insertMany.docs, options);
        // Return response
        resolve({
          ok:true, insertedCount: result.insertedCount, insertedIds: result.insertedIds
        });
      }).catch(reject);
    });
  }
}

var mergeOptions = function(op) {
  var object = {};
  var options = {'w':true, 'wtimeout':true, 'j':true, 'ordered':true, 'readPreference':true};

  for(var name in op) {
    // Rewrite the readPreference to use the right type
    if(op.readPreference) {
      var mode = op.readPreference.mode || 'primary';
      var tags = op.readPreference.tags;
      object[name] = new ReadPreference(mode, tags);
    } else if(options[name]) {
      object[name] = op[name];
    }
  }

  return object;
}

module.exports = ChannelHandler;
