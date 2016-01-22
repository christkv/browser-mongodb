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
ERRORS.REPLACE_CONTAINS_OPERATORS = 5;
ERRORS.LIVER_QUERY_ID_ILLEGAL = 6;

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
var validators = createValidators([
  { command: 'find', json: 'find_command.json' }, 
  { command: 'getMore', json: 'get_more_command.json' }, 
  { command: 'aggregate', json: 'aggregate_command.json' }, 
  { command: 'updateOne', json: 'update_one_command.json' }, 
  { command: 'updateMany', json: 'update_many_command.json' }, 
  { command: 'replaceOne', json: 'replace_one_command.json' }, 
  { command: 'insertOne', json: 'insert_one_command.json' }, 
  { command: 'insertMany', json: 'insert_many_command.json' }, 
  { command: 'deleteOne', json: 'delete_one_command.json' }, 
  { command: 'deleteMany', json: 'delete_many_command.json' }, 
  { command: 'findOneAndDelete', json: 'find_one_and_delete_command.json' }, 
  { command: 'findOneAndUpdate', json: 'find_one_and_update_command.json' }, 
  { command: 'findOneAndReplace', json: 'find_one_and_replace_command.json'}
]);

class ChannelHandler {
  constructor(client, liveQueryHandler, options) {
    this.client = client;
    this.liveQueryHandler = liveQueryHandler;
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
        promise = self.insert(true, op);
      } else if(op.insertMany) {
        promise = self.insert(false, op);
      } else if(op.updateOne) {
        promise = self.update(true, op);
      } else if(op.updateMany) {
        promise = self.update(false, op);
      } else if(op.replaceOne) {
        promise = self.replaceOne(op);
      } else if(op.deleteOne) {
        promise = self.delete(true, op);
      } else if(op.deleteMany) {
        promise = self.delete(false, op);
      } else if(op.find) {
        promise = self.find(op, connection);
      } else if(op.aggregate) {
        promise = self.aggregate(op);
      } else if(op.getMore) {
        promise = self.getMore(op);
      } else if(op.findOneAndDelete) {
        promise = self.findOneAndDelete(op);
      } else if(op.findOneAndUpdate) {
        promise = self.findOneAndUpdate(op);
      } else if(op.findOneAndReplace) {
        promise = self.findOneAndReplace(op);
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

  find(op, connection, options) {
    var self = this;
    options = options || { promoteLong: false };
    options.raw = options.raw || self.options.raw || true;

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
        var ns = op.find;
        var parts = op.find.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%")
        console.dir(op)

        // Do we have a live query
        var liveQuery = op.liveQuery || false;
        var liveQueryId = op.liveQueryId;
        // Remove the fields not compatible with the find command
        delete op['liveQuery'];
        delete op['liveQueryId'];

        // If we don't have a liveQueryId error out
        if(liveQuery && typeof liveQueryId != 'number') {
          return reject({
            ok:false, code: ERRORS.LIVER_QUERY_ID_ILLEGAL, message: 'liverQueryId not provided or not an integer', op: op
          });
        }

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

        // Register the live query
        if(liveQuery) {
          self.liveQueryHandler.register(connection, ns, liveQueryId, op);
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
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        var result = yield self.client.command({ismaster:true});
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

  replaceOne(op, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Perform the validation
        var results = validators.replaceOne.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

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
        var result = yield self.client.db(db).collection(collection).replaceOne(query, update, commandOptions);



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

  update(single, op, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Do we have a single op
        var validator = single ? validators.updateOne : validators.updateMany;
        // Perform the validation
        var results = validator.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }


        // Split the name space
        var parts = single ? op.updateOne.split('.') : op.updateMany.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Unpack the command
        var query = op.q;
        var update = op.u;
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
        if(single) {
          var result = yield self.client.db(db).collection(collection).updateOne(query, update, commandOptions);
        } else {
          var result = yield self.client.db(db).collection(collection).updateMany(query, update, commandOptions);
        }

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

  insert(single, op, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Do we have a single op
        var validator = single ? validators.insertOne : validators.insertMany;
        // Perform the validation
        var results = validator.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

        // Split the name space
        var parts = single ? op.insertOne.split('.') : op.insertMany.split('.');
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
        if(single) {
          var result = yield self.client.db(db).collection(collection).insertOne(op.doc, commandOptions);
        } else {
          var result = yield self.client.db(db).collection(collection).insertMany(op.docs, commandOptions);
        }

        // Final result
        var finalResult = {
          insertedCount: result.insertedCount,         
        };

        // Merge in the inserted ids
        if(result.insertedId) finalResult.insertedIds = [result.insertedId];
        if(result.insertedIds) finalResult.insertedIds = result.insertedIds;

        // Return the result;
        resolve(finalResult);
      }).catch(reject);
    });
  }

  delete(single, op, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Do we have a single op
        var validator = single ? validators.deleteOne : validators.deleteMany;
        // Perform the validation
        var results = validator.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

        // Split the name space
        var parts = single ? op.deleteOne.split('.') : op.deleteMany.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Merge the ops
        var commandOptions = {}
        if(op.bypassDocumentValidation) commandOptions.bypassDocumentValidation = op.bypassDocumentValidation;
        if(op.w) commandOptions.w = op.w;
        if(op.wtimeout) commandOptions.wtimeout = op.wtimeout;
        if(op.j) commandOptions.j = op.j;

        // Return full results
        commandOptions.fullResult = true;

        // Function to execute
        if(single) {
          var result = yield self.client.db(db).collection(collection).deleteOne(op.doc, commandOptions);
        } else {
          var result = yield self.client.db(db).collection(collection).deleteMany(op.docs, commandOptions);
        }

        // Return the result;
        resolve({
          deletedCount: result.deletedCount
        });
      }).catch(reject);
    });
  }

  findOneAndDelete(op, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Perform the validation
        var results = validators.findOneAndDelete.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

        // Split the name space
        var parts = op.findOneAndDelete.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Return full results
        op.fullResult = true;

        // Function to execute
        var result = yield self.client.db(db).collection(collection).findOneAndDelete(op.q, op);
        // Return the result;
        resolve(result.documents[0].value);
      }).catch(reject);
    });
  }

  findOneAndUpdate(op, options) { 
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Perform the validation
        var results = validators.findOneAndUpdate.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

        // Split the name space
        var parts = op.findOneAndUpdate.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Return full results
        op.fullResult = true;

        // Function to execute
        var result = yield self.client.db(db).collection(collection).findOneAndUpdate(op.q, op.u, op);

        // Return the result;
        resolve(result.documents[0].value);
      }).catch(reject);
    });
  }
      
  findOneAndReplace(op, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Perform the validation
        var results = validators.findOneAndReplace.validate(op);
        if(results.length > 0) {
          return reject({
            ok:false, code: ERRORS.FIND_COMMAND_FAILURE, message: 'command failed validation', op: op
          });
        }

        // Split the name space
        var parts = op.findOneAndReplace.split('.');
        var db = parts.shift();
        var collection = parts.join('.');

        // Return full results
        op.fullResult = true;

        // Function to execute
        var result = yield self.client.db(db).collection(collection).findOneAndReplace(op.q, op.u, op);

        // Return the result;
        resolve(result.documents[0].value);
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
