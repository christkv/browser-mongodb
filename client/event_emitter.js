"use strict"

var co = require('co'),
  nextTick = require('./util').nextTick;

class EventEmitter {
  constructor() {
    this._events = {};
  }

  //
  // Stream implementation
  //

  /**
   *
   */
  emit(event, obj) {
    var args = Array.prototype.slice.call(arguments, 1);

    if(this._events[event]) {
      for(var i = 0; i < this._events[event].length; i++) {
        this._events[event][i].apply(this._events[event][i], args);
      }
    }
  }

  /**
   *
   */
  on(event, callback) {
    var self = this;

    if(!this._events[event]) {
      this._events[event] = [];
    }

    // Push the callback to the list of events
    this._events[event].push(callback);

    // We are done
    if(event == 'data' && this._events[event].length == 1) {
      // Stream all the data
      var _read  = function() {
        co(function*() {
          // Get a document
          var doc = yield self.next();
          // If we have no document
          if(!doc) {
            return self.emit('end');
          }

          // We have a document
          if(doc) {
            self.emit('data', doc);
          }

          // Schedule another tick
          nextTick(_read);
        }).catch(function(err) {
          self.emit('error', err);
        });
      }

      nextTick(_read);
    }
  }
}

module.exports = EventEmitter;
