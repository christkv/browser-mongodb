"use strict"

var ChannelHandler = require('./mongodb/handler'),
  LiveQueryHandler = require('./live_query_handler'),
  f = require('util').format,
  fs = require('fs'),
  co = require('co');

// Default commands
var IsMaster = require('./mongodb/commands/ismaster.js'),
  Aggregate = require('./mongodb/commands/aggregate.js'),
  InsertOne = require('./mongodb/commands/insertOne.js'),
  InsertMany = require('./mongodb/commands/insertMany.js'),
  UpdateOne = require('./mongodb/commands/updateOne.js'),
  UpdateMany = require('./mongodb/commands/updateMany.js'),
  DeleteOne = require('./mongodb/commands/deleteOne.js'),
  DeleteMany = require('./mongodb/commands/deleteMany.js'),
  ReplaceOne = require('./mongodb/commands/replaceOne.js'),
  Find = require('./mongodb/commands/find.js'),
  GetMore = require('./mongodb/commands/getMore.js'),
  FindOneAndDelete = require('./mongodb/commands/findOneAndDelete.js'),
  FindOneAndUpdate = require('./mongodb/commands/findOneAndUpdate.js'),
  FindOneAndReplace = require('./mongodb/commands/findOneAndReplace.js');

class Channel  {
  constructor(channel) {
    this.channel = channel;
    this.pre = [];
  }

  before(handler) {
    this.pre.push(handler);
  }
}

var readAndParseJSON = function(file) {
  var json = fs.readFileSync(file, 'utf8');
  return JSON.parse(json);
}

class Server {
  constructor(client, options) {
    this.options = options || {}
    this.client = client;
    this.handlers = [];
    this.liveConnections = {};
    this.channels = {};

    // Handles the actual translation
    this.handler = new ChannelHandler(client, options);

    // Add default command handlers
    this.handler.register('ismaster', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/ismaster_command.json')), new IsMaster());
    this.handler.register('aggregate', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/aggregate_command.json')), new Aggregate());
    this.handler.register('insertOne', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/insert_one_command.json')), new InsertOne());
    this.handler.register('insertMany', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/insert_many_command.json')), new InsertMany());
    this.handler.register('updateOne', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/update_one_command.json')), new UpdateOne());
    this.handler.register('updateMany', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/update_many_command.json')), new UpdateMany());
    this.handler.register('deleteOne', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/delete_one_command.json')), new DeleteOne());
    this.handler.register('deleteMany', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/delete_many_command.json')), new DeleteMany());
    this.handler.register('find', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/find_command.json')), new Find());
    this.handler.register('getMore', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/get_more_command.json')), new GetMore());
    this.handler.register('replaceOne', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/replace_one_command.json')), new ReplaceOne());
    this.handler.register('findOneAndDelete', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/find_one_and_delete_command.json')), new FindOneAndDelete());
    this.handler.register('findOneAndUpdate', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/find_one_and_update_command.json')), new FindOneAndUpdate());
    this.handler.register('findOneAndReplace', readAndParseJSON(f('%s/%s', __dirname, 'mongodb/schemas/find_one_and_replace_command.json')), new FindOneAndReplace());
  }

  registerCommand(name, spec, command) {
    this.handler.register(name, spec, command);
    return this;
  }

  registerHandler(handler) {
    var self = this;
    // Push the handler to the list of available handlers
    this.handlers.push(handler);

    //
    // Transport received a new connection
    //
    handler.on('connection', function(connection) {
      self.liveConnections[connection.id] = connection;
    });

    //
    // Transport received a disconnect event
    //
    handler.on('disconnect', function() {
      delete this.liveConnections[connection.id];
    });

    return this;
  }

  connect() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var result = yield self.handler.ismaster();
        // We support live queries
        if(result.liveQuery) {
          // if(self.handler.)
          for(var name in self.handler.liveQueryHandlers) {
            yield self.handler.liveQueryHandlers[name].connect();
          }
        }

        resolve();
      }).catch(reject);
    });
  }

  destroy() {
    for(var name in this.handler.liveQueryHandlers) {
      this.handler.liveQueryHandlers[name].destroy();
    }
  }

  channel(channel, options) {
    var self = this;
    options = options || {};
    // Record the channel handlers
    this.channels[channel] = new Channel(channel);

    // Register live query handler
    self.handler.registerLiveQueryChannel(channel, new LiveQueryHandler(channel, self.client, options));

    // Add the actual handler for the channel
    this.channels[channel].handler = function(connection, channel, obj) {
      self.handler.handle(connection, channel, obj);
    }

    // Add the error handler for the channel
    this.channels[channel].errorHandler = function(connection, channel, obj, errors) {
      self.handler.error(connection, channel, obj, errors);
    }

    // Register the channel handlers
    for(var i = 0; i < this.handlers.length; i++) {
      this.handlers[i].channel(this.channels[channel]);
    }

    // Return the object
    return this.channels[channel];
  }
}

module.exports = Server;
