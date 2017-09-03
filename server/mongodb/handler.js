"use strict"

var co = require('co'),
  f = require('util').format,
  BSON = require('bson').pure(),
  EJSON = require('mongodb-extended-json'),
  ERRORS = require('./errors'),
  Compiler = new require('vitesse-jsonspec');

// JSONSchema compiler
var compiler = new Compiler();

// Class handler
class ChannelHandler {
  constructor(client, options) {
    this.client = client;
    this.options = options || {};
    this.bson = new BSON.BSON();
    this.liveQueryHandlers = {};

    // Registered handlers
    this.commands = {};
  }

  registerLiveQueryChannel(channel, handler) {
    this.liveQueryHandlers[channel] = handler;
  }

  error(connection, channel, doc, errors) {
    var err = {ok: false, _id: doc._id, code: ERRORS.PRE_CONDITION_FAILED, message: 'pre condition failed'};
    err.op = doc ? doc.op : {};

    // Add all the pre-errors
    err.errors = errors.map(function(x) {
      var err = {message: x.message};
      if(x.code) err.code = x.code;
      return err;
    });

    // Write the error
    connection.write(channel, err);
  }

  register(command, schema, handler) {
    var self = this;

    return new Promise(function(resolve, reject) {
      // Compile the json schema
      compiler.compile(schema, {closure:false}, function(err, validator) {
        if(err) return reject(err);
        // Add the command handler and resolve
        self.commands[command] = {validator: validator, handler: handler};
        resolve(self.commands[command]);
      });
    });
  }

  ismaster() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Get the ismaster result
        var result = yield self.commands['ismaster'].handler.handle(null, self.client, self.bson, {ismaster:true});
        // Return the result
        resolve(result);
      }).catch(reject);
    });
  }

  handle(connection, channel, doc, stream) {
    var self = this;

    co(function*() {
      // console.log("!!!!!!!!!!!!!!!!!!!!!! HANDLE")
      // console.dir(doc)
      // console.dir(stream == null)
      // Allways deserialize from extended JSON
      var op = EJSON.deserialize(doc.op);
      var promise = null;
      // console.dir(op)

      // Get command key
      var commandName = Object.keys(op)[0];

      // We have the command
      if(self.commands[commandName]) {
        // Unpack object
        var validator = self.commands[commandName].validator;
        var handler = self.commands[commandName].handler;

        // Contains the result
        var result = null;

        // Perform the validation
        var results = validator.validate(op);
        if(results.length > 0) {
          return connection.write(channel, {
            ok:false, 
            _id: doc._id, 
            code: ERRORS.FIND_COMMAND_FAILURE, 
            message: 'command failed validation', op: doc.op, 
            details: results.map(r => r.message),
          });
        }

        // Execute the promise
        if(handler.handleStream) {
          result = yield handler.handleStream(connection, self.client, self.bson, doc.op, op, self.liveQueryHandlers[channel], stream, self.options);
        } else {
          result = yield handler.handle(connection, self.client, self.bson, doc.op, op, self.liveQueryHandlers[channel], self.options);
        }

        // console.log(handler.handle.toString())
        // Null equals empty result
        result = result || {};
        // console.log("!!!!!!!!!!!!!!!!!!!!!! HANDLE 2")
        
        // Create the command response
        var cmd = {
          ok:true, _id: doc._id, result: result && result.connection ? result.result : result
        };
        // console.log("!!!!!!!!!!!!!!!!!!!!!! HANDLE 3")
        
        // Add the hashed connection id
        if(result && result.connection) cmd.connection = result.connection;
        // Write the content out
        connection.write(channel, cmd);
        // console.log("!!!!!!!!!!!!!!!!!!!!!! HANDLE 4")
      } else {
        // We have an unsuported protocol message
        return connection.write(channel, {
          ok: false, _id: doc._id, code: ERRORS.NO_SUCH_COMMAND, message: 'command does not exits', op: op
        });
      }
    }).catch(function(err) {
      // Error message
      var error = {
        ok:false, _id: doc._id, code: typeof err.code == 'number' ? err.code : ERRORS.GENERAL_COMMAND_FAILURE,
        message: err.message || 'command failure', op: doc ? doc.op : {}
      }

      // We have a series of errors
      if(Array.isArray(err)) {
        // Add all the pre-errors
        error.errors = err.map(function(x) {
          var err = {message: x.message};
          if(x.code) err.code = x.code;
          return err;
        });
      }

      // Write out the error command
      connection.write(channel, error);
    });
  }
}

module.exports = ChannelHandler;
