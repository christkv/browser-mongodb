"use strict"

var CommandCursor = require('./command_cursor');

class AggregationCursor extends CommandCursor {
  constructor(cmd, db, collection) {
    super(cmd, db, collection);
  }

  batchSize(value) {
    if(!this.cmd.cursor) this.cmd.cursor = {};
    this.options.batchSize = value;
    this.cmd.cursor.batchSize = value;
    return this;
  }
}

module.exports = AggregationCursor;
