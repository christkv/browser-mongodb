"use strict"

var Matcher = require('../mongodb/matcher');

class LiveQuery {
  constructor(namespace, id, connection, filter) {
    this.namespace = namespace;
    this.id = id;
    this.connection = connection;
    this.filter = new Matcher(filter);
  }
}

module.exports = LiveQuery;
