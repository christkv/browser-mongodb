"use strict"

class Callbacks {
  constructor() {
    this.callbacks = {};
    this._id = 0;
    this.cursors = {};
  }

  id() {
    return (this._id++) % Number.MAX_VALUE;
  }

  add(id, callback) {
    this.callbacks[id] = callback;
  }

  remove(id) {
    // Get the callback
    var callback = this.callbacks[id];
    // Delete the callback
    delete this.callbacks[id];
    // Return the callback
    return callback;
  }

  call(id, err, reply) {
    if(!this.callbacks[id]) {
      throw new Error('could not locate callback for id ' + id);
    }

    // Get the callback
    var callback = this.callbacks[id];
    // Delete the callback
    delete this.callbacks[id];
    // Perform the callback
    callback(err, reply);
  }

  flush(err) {
    var keys = Object.keys(this.callbacks);
    // Execute all the callbacks with the error
    for(var i = 0; i < keys.length; i++) {
      this.call(keys[i], err);
    }
  }

  //
  // Infrastructure allowing us to listen to changing queries
  //
  update(object) {
    // Do we have a cursor matching the update
    // Emit added/changed/removed event for the updateObject
    if(this.cursors[object.id]) {
      if(object.type == 'changed' || object.type == 'added') {
        this.cursors[object.id].emit(object.type, object.doc, object.fields);
      } else if(object.type == 'removed') {
        this.cursors[object.id].emit(object.type, object.doc);
      }
    }

    //
    // TODO: What to do if there are updates that have no known cursors on the client side
    //  - Send killcursors commands
  }

  liveQuery(cursor) {
    this.cursors[cursor.liveQueryId] = cursor;
  }

  unlisten(cursor) {
    delete this.cursors[cursor.cursorId];
  }
}

module.exports = Callbacks;
