"use strict"

var ChannelHandler = require('./mongodb/handler'),
  LiveQueryHandler = require('./live_query_handler'),
  co = require('co');

class Channel  {
  constructor(channel) {
    this.channel = channel;
    this.pre = [];
    this.post = [];
  }

  before(handler) {
    this.pre.push(handler);
  }

  after(handler) {
    this.post.push(handler);
  }
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
        // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ server 0")
        var result = yield self.handler.ismaster();
        // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ server 1")
        // console.dir(result)

        // We support live queries
        if(result.liveQuery) {
        // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ server 2")
          // yield self.liveQueryHandler.connect();
          // if(self.handler.)
          for(var name in self.handler.liveQueryHandlers) {
            console.log("-------------------------------- name = " + name)
            yield self.handler.liveQueryHandlers[name].connect();
          }
        }
        // console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ server 3")

        resolve();
      }).catch(reject);
    });
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

    // Register the channel handlers
    for(var i = 0; i < this.handlers.length; i++) {
      this.handlers[i].channel(this.channels[channel]);
    }

    // Return the object
    return this.channels[channel];
  }
}

module.exports = Server;
