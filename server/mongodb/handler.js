"use strict"

var co = require('co'),
  f = require('util').format,
  fs = require('fs'),
  ReadPreference = require('mongodb').ReadPreference,
  Long = require('mongodb').Long,
  ObjectId = require('mongodb').ObjectId,
  Binary = require('mongodb').Binary,
  Timestamp = require('mongodb').Timestamp,
  BSON = require('bson').pure(),
  EJSON = require('mongodb-extended-json'),
  Compiler = new require('vitesse-jsonspec');

// Error commands
var ERRORS = {};
ERRORS.NO_SUCH_COMMAND = 0;
ERRORS.FIND_COMMAND_FAILURE = 1;
ERRORS.GENERAL_COMMAND_FAILURE = 2;
ERRORS.GETMORE_COMMAND_FAILURE = 3;
ERRORS.CURSOR_NOT_FOUND = 4;

// Used to identify errors in Raw messages
var okFalse = new Buffer([1, 111, 107, 0, 0, 0, 0]);
var okTrue = new Buffer([1, 111, 107, 0, 0, 0, 1]);

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
}, {
  command: 'aggregate', json: 'aggregate_command.json'
}]);

class ChannelHandler {
  constructor(client, options) {
    this.client = client;
    this.options = options || {};
    this.bson = new BSON.BSON();
  }

  handle(connection, channel, doc) {
    var self = this;

    co(function*() {
      var op = doc.op;
      var promise = null;
      // Determine the type of operation
      if(op.ismaster) {
        promise = self.ismaster(op);
      } else if(op.insertOne) {
        promise = self.insertOne(op);
      } else if(op.insertMany) {
        promise = self.insertMany(op);
      } else if(op.find) {
        promise = self.find(op);
      } else if(op.aggregate) {
        promise = self.aggregate(op);
      } else if(op.getMore) {
        promise = self.getMore(op);
      } else {
        // We have an unsuported protocol message
        return connection.write(channel, {
          ok: false, _id: doc._id, code: ERRORS.NO_SUCH_COMMAND, message: 'command does not exits', op: op
        });
      }

      // Execute the promise
      var result = yield promise;

      // Create the command
      var cmd = {
        ok:true, _id: doc._id
      };

      // Add the hashed connection id
      if(result.connection) cmd.connection = result.connection;
      cmd.result = result.connection ? result.result : result;

      // Write the content out
      connection.write(channel, cmd);
    }).catch(function(err) {
      // Add the doc._id
      err._id = doc._id;
      err.code = typeof err.code == 'number' ? err.code : ERRORS.GENERAL_COMMAND_FAILURE;
      err.message = err.message || 'command failure';
      err.op = doc ? doc.op : {};
      // Write the error
      connection.write(channel, err);
    });
  }

  aggregate(op, options) {
    var self = this;
    options = options || { promoteLong: false };
    options.raw = options.raw || self.options.raw || true;
    // options.raw = false;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Perform the validation
        var results = validators.aggregate.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

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
        if(options.promoteLong == null) {
          options.promoteLong = true;
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

        // Execute the command
        var result = yield self.client.db(db).command(command, options);

        // Check if we have a raw response
        if(options.raw && result.documents[0].slice(0, 64).indexOf(okFalse) != -1) {
          var errorMessage = self.bson.deserialize(result.documents[0]);
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

  find(op, options) {
    var self = this;
    options = options || { promoteLong: false };
    options.raw = options.raw || self.options.raw || true;
    // options.raw = false;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Perform the validation
        var results = validators.find.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

        // Split the name space
        var parts = op.find.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Do we have a read Preference specified
        if(op.readPreference) {
          options.readPreference = new ReadPreference(op.readPreference.mode, op.readPreference.tags);
          delete op.readPreference;
        }

        // No pomoteLong set then default to false
        if(options.promoteLong == null) {
          options.promoteLong = true;
        }

        // Get the full result
        options.fullResult = true;

        // Execute the command
        var result = yield self.client.db(db).command(Object.assign(op, {
          find: collection
        }), options);

        // Check if we have a raw response
        if(options.raw && result.documents[0].slice(0, 64).indexOf(okFalse) != -1) {
          var errorMessage = self.bson.deserialize(result.documents[0]);
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

  getMore(op, options) {
    var self = this;
    options = options || {};
    options.raw = options.raw || self.options.raw || true;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Perform the validation
        var results = validators.getMore.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.GETMORE_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

        // Ensure we have valid object
        op = EJSON.deserialize(op);

        // Split the name space
        var parts = op.getMore.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Do we need to pin the command to an operation
        if(op.connection) {
          // Find a connection that can take the getMore
          var connections = self.client.serverConfig.connections();
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
        var result = yield self.client.db(db).command(command, options);

        // Create extended EJSON if don't have a raw query
        if(!options.raw) {
          result.documents[0] = JSON.parse(EJSON.stringify(result.documents[0]));
        }

        // Check if we have a raw response
        if(options.raw && result.documents[0].slice(0, 64).indexOf(okFalse) != -1) {
          var errorMessage = self.bson.deserialize(result.documents[0]);
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

  ismaster(doc, options) {
    options = options || {};

    return new Promise(function(resolve, reject) {
      resolve({
        ok: true, insert:true, update:true, delete:true,
        findAndModify:true, commands: ['ismaster'], listen: true
      });
    });
  }

  insertOne(op, options) {
    var self = this;
    options = options || {};

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
          insertedCount: result.insertedCount, insertedIds: [result.insertedId]
        });
      }).catch(reject);
    });
  }

  insertMany(op, options) {
    var self = this;
    options = options || {};

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
          insertedCount: result.insertedCount, insertedIds: result.insertedIds
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
