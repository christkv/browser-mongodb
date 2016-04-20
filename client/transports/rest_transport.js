"use strict"

var Promise = require('../util').Promise,
  nextTick = require('../util').nextTick,
  // Ajax = require('./ajax'),
  EventEmitter = require('../event_emitter');

// Fire Ajax event
var execute = function(self, url, obj) {
  var xhr = null;
  if(window && window.ActiveXObject) { xhr = window.ActiveXObject('Microsoft.XMLHTTP'); }
  else if(window && window.XMLHttpRequest) { xhr = new window.XMLHttpRequest(); }

  return new Promise(function(resolve, reject) {
    // String to write
    var finalObj = typeof obj == 'string' ? obj : JSON.stringify(obj);
    // Open a POST request
    xhr.open('POST', url, true);
    //Send the proper header information along with the request
    xhr.setRequestHeader("Content-Type", "application/json");

    // Wait for state changes
    xhr.onreadystatechange = function() {//Call a function when the state changes.
      if(xhr.readyState == 4 && xhr.status == 200) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch(err) {
          reject(err);
        }
      } else if(xhr.readyState == 4 && xhr.status == 200) {
        reject(new Error(xhr.responseText));
      }
    }

    // Send the final object
    xhr.send(finalObj);
  });
}


class Connection extends EventEmitter {
  constructor(url) {
    super();
    var self = this;
    this.url = url;
    this.handlers = {};

    // Emit connect event
    nextTick(function() {
      self.emit('connect');
    });
  }

  onChannel(channel, callback) {
    this.handlers[channel] = callback;
  }

  write(channel, obj) {
    var self = this;
    // console.log("CLIENT :: !!!!!!!!!!!!!!! WRITE :: " + this.url)
    // console.dir(obj)
    execute(this, this.url, {channel: channel, obj: obj}).then(function(r) {
      // console.log("CLIENT :: !!!!!!!!!!!!!!! WRITE 1 :: ")
      // console.dir(r)

      // Check if we have a handler
      if(!self.handlers[r.channel]) {
        return self.emit('error', new Error('no handler found for the channel ' + r.channel));
      }

      // Unpack and call the handler
      self.handlers[r.channel](r.obj);
    });
  }
}

class RESTTransport {
  constructor(url, options) {
    this.url = url;
    this.options = options || {};
  }

  connect(url, options) {
    var self = this;

    return new Promise(function(resolve, reject) {
      try {
        resolve(new Connection(url));
      } catch(err) {
        reject(err);
      }
    });
  }

  isConnected() {
    return true;
  }

  on() {
  }

  emit() {
  }
}

module.exports = RESTTransport;
