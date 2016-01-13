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
  describe('MongoDB API change notification', function() {
    it('listen to notifications', function(done) {
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
            if(op.ops && op.ops[0].find) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{_id:1, a: 1}, {_id:2, a: 2}] }]
              });
            } else if(op.ops && op.ops[0].getMore && op._id == 1) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: '12ab12ab12ab12ab12ab12ab', documents: [{_id:3, a: 3}, {_id:4, a: 4}] }]
              });
            } else if(op.ops && op.ops[0].getMore && op._id == 2) {
              this.emit('mongodb', {
                ok:true, _id: op._id,
                r: [{ ok:true, cursorId: null, documents: [{_id:5, a: 5}] }]
              });
            }
          });

          // Set a timeout and emit some query change events
          setTimeout(function() {
            mock.emit('mongodb', {
              ok:true, change:true, updates: [{
                  type: 'added',
                  cursorId: '12ab12ab12ab12ab12ab12ab',
                  doc: {
                    _id: 6,
                    fields: {_id: 6, c:1}
                  }
                }, {
                  type: 'removed',
                  cursorId: '12ab12ab12ab12ab12ab12ab',
                  doc: {
                    _id: 3
                  }
                }, {
                  type: 'changed',
                  cursorId: '12ab12ab12ab12ab12ab12ab',
                  doc: {
                    _id: 1,
                    fields: {a:3, c:1}
                  }
                }
              ]
            })

            // Validate all changes received
            setTimeout(function() {
              assert.deepEqual([
                { t:'added', id: 6, fields: {_id:6, c:1} },
                { t:'removed', id: 3 },
                { t:'changed', id: 1, fields: {a:3, c:1} },
              ], changes)

              done();
            }, 10)
          }, 10);

          // Create a cursor and iterate
          var cursor = collection.find({}).listen();
          var docs = [];
          var changes = [];

          cursor.on('end', function() {
            assert.deepEqual([ { a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 } ], docs);
          });

          cursor.on('data', function(doc) {
            docs.push(doc);
          });

          cursor.on('added', function(id, fields) {
            assert.equal(6, id);
            assert.deepEqual({_id:6, c:1}, fields);
            changes.push({t: 'added', id:id, fields: fields});
          });

          cursor.on('removed', function(id) {
            assert.equal(3, id);
            changes.push({t: 'removed', id:id});
          });

          cursor.on('changed', function(id, fields) {
            assert.equal(1, id);
            assert.deepEqual({a:3, c:1}, fields);
            changes.push({t: 'changed', id:id, fields: fields});
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
