"use strict"

var ChannelHandler = require('./mongodb/handler');

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
    this.handler = new ChannelHandler(client);
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

  channel(channel) {
    var self = this;
    // Record the channel handlers
    this.channels[channel] = new Channel(channel);

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
