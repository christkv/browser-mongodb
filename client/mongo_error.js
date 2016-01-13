"use strict"

class MongoError extends Error {
  constructor(object) {
    super();
    Object.assign(this, object);
  }
}

module.exports = MongoError;
