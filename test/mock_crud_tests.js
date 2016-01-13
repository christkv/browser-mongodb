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
  describe('MongoDB API Connections', function() {
    it('correctly connect', function(done) {
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
        done();
      });

      // Trigger the connect event
      mock.trigger('connect');
    });

    it('fail connection', function(done) {
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
      }).catch(function(e) {
        assert.equal('failed to connect', e.message);
        done();
      });

      // Trigger the connect event
      mock.trigger('error', new Error('failed to connect'));
    });
  });

  describe('MongoDB API Insert', function() {
    it('correctly insert single document', function(done) {
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
          mock.once('mongodb', function(op) {
            if(op.ops[0].insertOne) {
              this.emit('mongodb', {
                ok: true,
                _id: 0,
                r: [{
                  ok:true,
                  insertedIds: {'0': '12ab12ab12ab12ab12ab12ab'},
                  insertedCount: 1
                }]
              });
            }
          });

          // Perform an insertOne operation
          var result = yield collection.insertOne({a:1});
          assert.equal(true, result.ok);
          assert.deepEqual({'0': '12ab12ab12ab12ab12ab12ab'}, result.insertedIds);
          assert.equal(1, result.insertedCount);
          done();
        }).catch(function(e) {
          console.log(e.stack);
        })
      });

      // Trigger the connect event
      mock.trigger('connect');
    });

    it('correctly insert many documents', function(done) {
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
          mock.once('mongodb', function(op) {
            if(op.ops[0].insertMany) {
              this.emit('mongodb', {
                ok: true,
                _id: 0,
                r: [{
                  ok:true,
                  insertedIds: {
                    '0': '12ab12ab12ab12ab12ab12ab',
                    '1': '23ab23ab23ab23ab23ab23ab'},
                  insertedCount: 1
                }]
              });
            }
          });

          // Perform an insertOne operation
          var result = yield collection.insertMany([{a:1}, {a:1}]);
          assert.equal(true, result.ok);
          assert.deepEqual({
            '0': '12ab12ab12ab12ab12ab12ab',
            '1': '23ab23ab23ab23ab23ab23ab'}, result.insertedIds);
          assert.equal(1, result.insertedCount);
          done();
        }).catch(function(e) {
          console.log(e.stack);
        })
      });

      // Trigger the connect event
      mock.trigger('connect');
    });
  });
});
