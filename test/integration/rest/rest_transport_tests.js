"use strict"

var co = require('co'),
  path = require('path'),
  assert = require('assert'),
  f = require('util').format,
  express = require('express'),
  bodyParser = require('body-parser'),
  ExpressRESTTransport = require('../../../server/express_rest_transport'),
  Server = require('../../../server/server'),
  MongoClient = require('mongodb').MongoClient;

// MongoDB Topology Manager
var ServerManager = require('mongodb-topology-manager').Server,
  ReplSetManager = require('mongodb-topology-manager').ReplSet;

// Get the client so we can simulate the Browser - Server connection
var MongoBrowserClient = require('../../../client/mongo_client'),
  RESTClientTransport = require('../../../client/transports/rest_transport'),
  ioClient = require('socket.io-client');

var createServer = function() {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Create express application
      var app = express();

      // Set up some mock values for easy testing
      if(!global.window) global.window = {};
      global.window.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

      // configure the app to use bodyParser()
      app.use(bodyParser.urlencoded({
          extended: true
      }));
      app.use(bodyParser.json());

      // Get the MongoClient
      var client = yield MongoClient.connect('mongodb://localhost:27017/test');
      // Add to the server
      var mongoDBserver = new Server(client, {});
      // Attach to the express
      mongoDBserver.registerHandler(new ExpressRESTTransport('/mongodb', app));

      // Register channel handlers these are used to handle any data before it's passed through
      // to the mongodb handler
      mongoDBserver.channel('mongodb');

      // Listen to the http server
      var server = app.listen(8080, function() {
        resolve({
          httpServer: server,
          client: client,
          mongoDBserver: mongoDBserver
        });
      });
    }).catch(function(err) {
      reject(err);
    });
  });
}

describe('REST Integration', function() {
  describe('MongoDB Connection', function() {
    it('correctly connect', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB CRUD Insert Operations', function() {
    it('correctly perform insertOne', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertOne({a:1}, {w:1});
        assert.equal(1, result.insertedCount);
        assert.equal(1, result.insertedIds.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform insertMany', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}, {a:2}], {w:1});
        assert.equal(2, result.insertedCount);
        assert.equal(2, Object.keys(result.insertedIds).length);
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB CRUD Update Operations', function() {
    it('correctly perform updateOne', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an upsert
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1}, {a:1}, {upsert:true, w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(1, result.upsertedCount);
        assert.equal(0, result.modifiedCount);
        assert.equal(0, result.upsertedId.index);

        // Perform an update
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1}, {$set: {b:1}}, {w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(0, result.upsertedCount);
        assert.equal(1, result.modifiedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform updateMany', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an upsert
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1, b:1}, {a:1, b:1}, {upsert:true, w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(1, result.upsertedCount);
        assert.equal(0, result.modifiedCount);
        assert.equal(0, result.upsertedId.index);

        // Perform an upsert
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1, b:2}, {a:1, b:2}, {upsert:true, w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(1, result.upsertedCount);
        assert.equal(0, result.modifiedCount);
        assert.equal(0, result.upsertedId.index);

        // Perform an update
        var result = yield connectedClient.db('test').collection('tests').updateMany({a:1}, {$set: {c:1}}, {w:1});
        assert.equal(2, result.matchedCount);
        assert.equal(0, result.upsertedCount);
        assert.equal(2, result.modifiedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform replaceOne', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an upsert
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1}, {a:1}, {upsert:true, w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(1, result.upsertedCount);
        assert.equal(0, result.modifiedCount);
        assert.equal(0, result.upsertedId.index);

        // Perform a replaceOne
        var result = yield connectedClient.db('test').collection('tests').replaceOne({a:1}, {a:1, b:1}, {w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(0, result.upsertedCount);
        assert.equal(1, result.modifiedCount);

        try {
          // Fail a replaceOne
          var result = yield connectedClient.db('test').collection('tests').replaceOne({a:1}, {$set: {a:2}}, {w:1});
          assert.ok(false);
        } catch(e) {
          assert.equal('replace document contains operators', e.message);
        }

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB CRUD Delete Operations', function() {
    it('correctly perform deleteOne', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertOne({a:1}, {w:1});
        assert.equal(1, result.insertedCount);
        assert.equal(1, result.insertedIds.length);

        // Perform a deleteOne
        var result = yield connectedClient.db('test').collection('tests').deleteOne({a:1}, {w:1});
        assert.equal(1, result.deletedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform deleteMany', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}, {a:1}], {w:1});
        assert.equal(2, result.insertedCount);
        assert.equal(2, Object.keys(result.insertedIds).length);

        // Perform a deleteOne
        var result = yield connectedClient.db('test').collection('tests').deleteMany({a:1}, {w:1});
        assert.equal(2, result.deletedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB CRUD findAndModify Operations', function() {
    it('correctly perform findOneAndDelete', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}, {a:1}], {w:1});
        assert.equal(2, result.insertedCount);
        assert.equal(2, Object.keys(result.insertedIds).length);

        // Perform a findOneAndDelete
        var result = yield connectedClient.db('test').collection('tests').findOneAndDelete({a:1}, {w:1});
        assert.equal(1, result.a);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform findOneAndUpdate', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}, {a:1}], {w:1});
        assert.equal(2, result.insertedCount);
        assert.equal(2, Object.keys(result.insertedIds).length);

        // Perform a findOneAndDelete
        var result = yield connectedClient.db('test').collection('tests').findOneAndUpdate({a:1}, {a:1, b:1}, {returnOriginal:false, w:1});
        assert.equal(1, result.a);
        assert.equal(1, result.b);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform findOneAndReplace', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}, {a:1}], {w:1});
        assert.equal(2, result.insertedCount);
        assert.equal(2, Object.keys(result.insertedIds).length);

        // Perform a findOneAndDelete
        var result = yield connectedClient.db('test').collection('tests').findOneAndReplace({a:1}, {a:1, b:1}, {returnOriginal:false, w:1});
        assert.equal(1, result.a);
        assert.equal(1, result.b);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB API Cursor', function() {
    it('correctly peform cursor iteration using toArray and raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Create documents
        var insertDocs = []; for(var i = 0; i < 1005; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(1005, result.insertedCount);
        assert.equal(1005, Object.keys(result.insertedIds).length);

        var s = new Date().getTime();
        // Iterate over all the cursors
        var docs = yield connectedClient.db('test').collection('tests').find({}).toArray();
        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));
        // Assert the values
        assert.equal(1005, docs.length);

        // Set different batchSize
        var docs = yield connectedClient.db('test').collection('tests').find({}).batchSize(20).toArray();
        assert.equal(1005, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform cursor iteration using toArray and no raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Create documents
        var insertDocs = []; for(var i = 0; i < 1005; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(1005, result.insertedCount);
        assert.equal(1005, Object.keys(result.insertedIds).length);

        var s = new Date().getTime();
        // Iterate over all the cursors
        var docs = yield connectedClient.db('test').collection('tests').find({}).toArray();
        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));
        // Assert the values
        assert.equal(1005, docs.length);

        // Set different batchSize
        var docs = yield connectedClient.db('test').collection('tests').find({}).batchSize(20).toArray();
        assert.equal(1005, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform cursor iteration using hasNext and next with raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 1005; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(1005, result.insertedCount);
        assert.equal(1005, Object.keys(result.insertedIds).length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').find({});

        var s = new Date().getTime();
        // Iterate over all the cursors
        while(yield cursor.hasNext()) {
          docs.push(yield cursor.next());
        }

        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));

        // Assert the values
        assert.equal(1005, docs.length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').find({}).batchSize(20);

        var s = new Date().getTime();
        // Iterate over all the cursors
        while(yield cursor.hasNext()) {
          docs.push(yield cursor.next());
        }

        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));

        // Assert the values
        assert.equal(1005, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform cursor iteration using hasNext and next with without raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:false});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 1005; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(1005, result.insertedCount);
        assert.equal(1005, Object.keys(result.insertedIds).length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').find({});

        var s = new Date().getTime();
        // Iterate over all the cursors
        while(yield cursor.hasNext()) {
          docs.push(yield cursor.next());
        }
        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));

        // Assert the values
        assert.equal(1005, docs.length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').find({}).batchSize(20);

        var s = new Date().getTime();
        // Iterate over all the cursors
        while(yield cursor.hasNext()) {
          docs.push(yield cursor.next());
        }

        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));

        // Assert the values
        assert.equal(1005, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform query iteration using stream', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:false});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 105; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(105, result.insertedCount);
        assert.equal(105, Object.keys(result.insertedIds).length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').find({});
        cursor.on('data', function(item) {
          docs.push(item);
        });

        cursor.on('end', function(item) {
          co(function*() {
            // Assert the values
            assert.equal(105, docs.length);

            // Shut down the
            httpServer.close();
            // Shut down MongoDB connection
            dbClient.close();
            // Shut down MongoDB instance
            yield manager.stop();
            done();
          });
        });
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB Aggregation Cursor', function() {
    it('correctly peform aggregation iteration using toArray and raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 205; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(205, result.insertedCount);
        assert.equal(205, Object.keys(result.insertedIds).length);

        var s = new Date().getTime();
        // Iterate over all the cursors
        var docs = yield connectedClient.db('test').collection('tests').aggregate([{$match: {}}]).toArray();
        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));
        // Assert the values
        assert.equal(205, docs.length);

        var docs = yield connectedClient.db('test').collection('tests').aggregate([{$match: {}}]).batchSize(20).toArray();
        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));
        // Assert the values
        assert.equal(205, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform aggregation iteration using toArray and no raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 105; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(105, result.insertedCount);
        assert.equal(105, Object.keys(result.insertedIds).length);

        var s = new Date().getTime();
        // Iterate over all the cursors
        var docs = yield connectedClient.db('test').collection('tests').aggregate([{$match: {}}]).toArray();
        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));
        // Assert the values
        assert.equal(105, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform aggregate iteration using hasNext and next with raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 105; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(105, result.insertedCount);
        assert.equal(105, Object.keys(result.insertedIds).length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').aggregate([{$match: {}}]);

        var s = new Date().getTime();
        // Iterate over all the cursors
        while(yield cursor.hasNext()) {
          docs.push(yield cursor.next());
        }

        var e = new Date().getTime();
        // console.log("==================== time ms :: " + (e - s));

        // Assert the values
        assert.equal(105, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform cursor iteration using hasNext and next with without raw', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:false});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 105; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(105, result.insertedCount);
        assert.equal(105, Object.keys(result.insertedIds).length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').aggregate([{$match:{}}]);

        var s = new Date().getTime();
        // Iterate over all the cursors
        while(yield cursor.hasNext()) {
          docs.push(yield cursor.next());
        }
        var e = new Date().getTime();

        // Assert the values
        assert.equal(105, docs.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly peform aggregation iteration using stream', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:false});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 105; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(105, result.insertedCount);
        assert.equal(105, Object.keys(result.insertedIds).length);

        var docs = [];
        var cursor = connectedClient.db('test').collection('tests').aggregate([{$match:{}}]);
        cursor.on('data', function(item) {
          docs.push(item);
        });

        cursor.on('end', function(item) {
          co(function*() {
            // Assert the values
            assert.equal(105, docs.length);

            // Shut down the
            httpServer.close();
            // Shut down MongoDB connection
            dbClient.close();
            // Shut down MongoDB instance
            yield manager.stop();
            done();
          });
        });
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  class PingCommand {
    constructor() {
    }

    handle(connection, mongoClient, bson, originalOp, op, liveQueryHandler, options) {
      return new Promise(function(resolve, reject) {
        co(function*() {
          resolve({ ok: true });
        }).catch(reject);
      });
    }
  }

  class FailCommand {
    constructor() {
    }

    handle(connection, mongoClient, bson, originalOp, op, liveQueryHandler, options) {
      return new Promise(function(resolve, reject) {
        co(function*() {
          if(op.fail && !op.multiple) {
            return reject(new Error('requested command failure'));
          } else if(op.fail && op.multiple){
            return reject([new Error('requested command failure'), new Error('requested command failure 2')]);
          }

          resolve({ ok: true });
        }).catch(reject);
      });
    }
  }

  describe('Custom Command Extensions', function() {
    it('add custom ping command', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Register a custom command
        //
        mongoDBserver.registerCommand('ping', {
          "properties": {
            "ping": { "type": "boolean" }
          },
          "required": ["ping"]
        }, new PingCommand());

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Execute ping command
        var result = yield connectedClient.db('admin').command({ping:true});
        assert.equal(true, result.ok);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('add custom fail command that allows for easy triggering of errors', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Register a custom command
        //
        mongoDBserver.registerCommand('fail', {
          "properties": {
            "fail": { "type": "boolean" }
          },
          "required": ["fail"]
        }, new FailCommand());

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Execute fail command
        var result = yield connectedClient.db('admin').command({fail:false});
        assert.equal(true, result.ok);

        // Execute fail command with error
        try {
          var err = null;
          var result = yield connectedClient.db('admin').command({fail:true});
        } catch(e) {
          err = e;
        }

        // Execute fail command with multiple error
        try {
          var err = null;
          var result = yield connectedClient.db('admin').command({fail:true, multiple:true});
        } catch(e) {
          err = e;
        }

        assert.ok(err != null);
        assert.deepEqual([ { message: 'requested command failure' },
          { message: 'requested command failure 2' } ], err.errors);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB Errors', function() {
    it('correctly catch errors when using executing illegal command', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Execute a command that does not exist and receive the error code
        try {
          var result = yield connectedClient.db('test').command({buildProfile:true});
        } catch(err) {
          assert.equal(0, err.code);
          assert.equal('command does not exits', err.message);
          assert.deepEqual({buildProfile:true}, err.op);
        }

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly catch errors when mid iteration due to illegal cursor id in raw mode', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Create documents
        var insertDocs = []; for(var i = 0; i < 1005; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(1005, result.insertedCount);
        assert.equal(1005, Object.keys(result.insertedIds).length);

        // Attempt to cause error in find command
        var cursor = connectedClient.db('test').collection('tests').find({});
        var docs = [];

        try {
          // Iterate over all the cursors
          while(yield cursor.hasNext()) {
            // Muck up the cursor Id
            cursor.cursorId = Long.fromNumber(5);
            docs.push(yield cursor.next());
          }

          assert.true(false);
        } catch(err) {
        }

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly catch errors when mid iteration due to illegal cursor id not in raw mode', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Create documents
        var insertDocs = []; for(var i = 0; i < 1005; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(1005, result.insertedCount);
        assert.equal(1005, Object.keys(result.insertedIds).length);

        // Attempt to cause error in find command
        var cursor = connectedClient.db('test').collection('tests').find({});
        var docs = [];
        var code = null;

        try {
          // Iterate over all the cursors
          while(yield cursor.hasNext()) {
            // Muck up the cursor Id
            cursor.cursorId = Long.fromNumber(5);
            docs.push(yield cursor.next());
          }

          assert.true(false);
        } catch(err) {
          code = err.code;
        }

        assert.ok(typeof code == 'number');
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly catch errors when executing cursor find in raw mode', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new RESTClientTransport('/mongodb', {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080/mongodb');

        // Create documents
        var insertDocs = []; for(var i = 0; i < 1005; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(1005, result.insertedCount);
        assert.equal(1005, Object.keys(result.insertedIds).length);

        // Attempt to cause error in find command
        var cursor = connectedClient.db('test').collection('tests').find({$noman:true});
        var docs = [];
        var code = null;

        try {
          // Iterate over all the cursors
          while(yield cursor.hasNext()) {
            docs.push(yield cursor.next());
          }

          assert.true(false);
        } catch(err) {
          code = err.code;
        }

        assert.ok(typeof code == 'number');
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });
});
