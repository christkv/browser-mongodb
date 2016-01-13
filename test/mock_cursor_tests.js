"use strict"

var EventEmitter = require('events').EventEmitter,
  co = require('co'),
  assert = require('assert');

class MockTransport extends EventEmitter {
  constructor() {
    super();
  }

  trigger(event) {
    var args = Array.prototype.slice.call(arguments);
    // Emit the event and any passed in values
    this.emit.apply(this, [event].concat(args.slice(1)));
  }
}

describe('Browser', function() {
  describe('MongoDB API cursor operations', function() {
    it('correctly execute next document with getmore', function(done) {
      // Get the client
      var MongoClient = require('../client/mongo_client');
      // The mock transport object
      var mock = new MockTransport();
      // Create an instance
      var client = new MongoClient(function() {
        return mock;
      });

      // Attempt to connect
      client.connect('mongodb://localhost:27017/app').then(function(client) {
        co(function*() {
          // Get a database
          var db = client.db('test');
          // Get a collection
          var collection = db.collection('col');

          // Add mock listener
          mock.on('mongodb', function(op) {
            if(op.ops[0].find) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{a: 1}, {a: 2}] }]
              });
            } else if(op.ops[0].getMore) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: null, documents: [{a: 3}] }]
              });
            }
          });

          // Create a cursor and iterate
          var cursor = collection.find({});
          assert.deepEqual({a:1}, yield cursor.next())
          assert.deepEqual({a:2}, yield cursor.next())
          assert.deepEqual({a:3}, yield cursor.next())
          assert.deepEqual(null, yield cursor.next())

          // should cause rejection due to the cursor being exhausted
          var document = yield cursor.next();
        }).catch(function(e) {
          done();
        })
      });

      // Trigger the connect event
      mock.trigger('connect');
    });

    it('correctly execute next document with only single find', function(done) {
      // Get the client
      var MongoClient = require('../client/mongo_client');
      // The mock transport object
      var mock = new MockTransport();
      // Create an instance
      var client = new MongoClient(function() {
        return mock;
      });

      // Attempt to connect
      client.connect('mongodb://localhost:27017/app').then(function(client) {
        co(function*() {
          // Get a database
          var db = client.db('test');
          // Get a collection
          var collection = db.collection('col');

          // Add mock listener
          mock.on('mongodb', function(op) {
            if(op.ops[0].find) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: null, documents: [{a: 1}, {a: 2}] }]
              });
            }
          });

          // Create a cursor and iterate
          var cursor = collection.find({});
          assert.deepEqual({a:1}, yield cursor.next())
          assert.deepEqual({a:2}, yield cursor.next())
          assert.deepEqual(null, yield cursor.next())

          // should cause rejection due to the cursor being exhausted
          var document = yield cursor.next();
        }).catch(function(e) {
          done();
        })
      });

      // Trigger the connect event
      mock.trigger('connect');
    });

    it('correctly execute next document with two getMores', function(done) {
      // Get the client
      var MongoClient = require('../client/mongo_client');
      // The mock transport object
      var mock = new MockTransport();
      // Create an instance
      var client = new MongoClient(function() {
        return mock;
      });

      // Attempt to connect
      client.connect('mongodb://localhost:27017/app').then(function(client) {
        co(function*() {
          // Get a database
          var db = client.db('test');
          // Get a collection
          var collection = db.collection('col');

          // Add mock listener
          mock.on('mongodb', function(op) {
            if(op.ops[0].find) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{a: 1}, {a: 2}] }]
              });
            } else if(op.ops[0].getMore && op._id == 1) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{a: 3}, {a: 4}] }]
              });
            } else if(op.ops[0].getMore && op._id == 2) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: null, documents: [{a: 5}] }]
              });
            }
          });

          // Create a cursor and iterate
          var cursor = collection.find({});
          assert.deepEqual({a:1}, yield cursor.next())
          assert.deepEqual({a:2}, yield cursor.next())
          assert.deepEqual({a:3}, yield cursor.next())
          assert.deepEqual({a:4}, yield cursor.next())
          assert.deepEqual({a:5}, yield cursor.next())
          assert.deepEqual(null, yield cursor.next())

          // should cause rejection due to the cursor being exhausted
          var document = yield cursor.next();
        }).catch(function(e) {
          done();
        })
      });

      // Trigger the connect event
      mock.trigger('connect');
    });

    it('correctly iterate using hasNext and next', function(done) {
      // Get the client
      var MongoClient = require('../client/mongo_client');
      // The mock transport object
      var mock = new MockTransport();
      // Create an instance
      var client = new MongoClient(function() {
        return mock;
      });

      // Attempt to connect
      client.connect('mongodb://localhost:27017/app').then(function(client) {
        co(function*() {
          // Get a database
          var db = client.db('test');
          // Get a collection
          var collection = db.collection('col');

          // Add mock listener
          mock.on('mongodb', function(op) {
            if(op.ops[0].find) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{a: 1}, {a: 2}] }]
              });
            } else if(op.ops[0].getMore && op._id == 1) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{a: 3}, {a: 4}] }]
              });
            } else if(op.ops[0].getMore && op._id == 2) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: null, documents: [{a: 5}] }]
              });
            }
          });

          // All the docs
          var docs = [];

          // Create a cursor and iterate
          var cursor = collection.find({});

          // Iterate over all the options
          while(yield cursor.hasNext()) {
            docs.push(yield cursor.next());
          }

          // Assert correct iteration
          assert.deepEqual([ { a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 } ], docs);

          // should cause rejection due to the cursor being exhausted
          var document = yield cursor.next();
        }).catch(function(e) {
          done();
        })
      });

      // Trigger the connect event
      mock.trigger('connect');
    });

  });

  describe('MongoDB API cursor stream operations', function() {
    it('correctly fetch documents using stream', function(done) {
      // Get the client
      var MongoClient = require('../client/mongo_client');
      // The mock transport object
      var mock = new MockTransport();
      // Create an instance
      var client = new MongoClient(function() {
        return mock;
      });

      // Attempt to connect
      client.connect('mongodb://localhost:27017/app').then(function(client) {
        co(function*() {
          // Get a database
          var db = client.db('test');
          // Get a collection
          var collection = db.collection('col');

          // Add mock listener
          mock.on('mongodb', function(op) {
            if(op.ops[0].find) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{a: 1}, {a: 2}] }]
              });
            } else if(op.ops[0].getMore && op._id == 1) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{a: 3}, {a: 4}] }]
              });
            } else if(op.ops[0].getMore && op._id == 2) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: null, documents: [{a: 5}] }]
              });
            }
          });

          // Create a cursor and iterate
          var cursor = collection.find({});
          var docs = [];

          cursor.on('end', function() {
            // Assert correct iteration
            assert.deepEqual([ { a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 } ], docs);
            done();
          });

          cursor.on('data', function(doc) {
            docs.push(doc);
          });
        }).catch(function(e) {
          console.log(e.stack);
        })
      });

      // Trigger the connect event
      mock.trigger('connect');
    });
  });
});
