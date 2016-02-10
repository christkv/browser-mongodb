var co = require('co'),
  path = require('path'),
  assert = require('assert'),
  f = require('util').format,
  SocketIOTransport = require('../../server/socket_io_transport'),
  Server = require('../../server/server'),
  MongoClient = require('mongodb').MongoClient;

// MongoDB Topology Manager
var ServerManager = require('mongodb-topology-manager').Server,
  ReplSetManager = require('mongodb-topology-manager').ReplSet;

// Get the client so we can simulate the Browser - Server connection
var MongoBrowserClient = require('../../client/mongo_client'),
  SocketIOClientTransport = require('../../client/transports/socket_io_transport'),
  ioClient = require('socket.io-client');

var createServer = function(options) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      var httpServer = require('http').createServer(function(req, res) {
        res.end("Hello World Page");
      });

      // Get the MongoClient
      var client = yield MongoClient.connect('mongodb://localhost:27017/test', {
        db: {
          promoteLongs: false
        }
      });

      // Add to the server
      var mongoDBserver = new Server(client, options || {});
      // Add a socket transport
      mongoDBserver.registerHandler(new SocketIOTransport(httpServer));

      // Register channel handlers these are used to handle any data before it's passed through
      // to the mongodb handler
      mongoDBserver.channel('mongodb');

      // Listen to the http server
      httpServer.listen(8080, function() {
        resolve({
          httpServer: httpServer,
          client: client,
          mongoDBserver: mongoDBserver
        });
      });
    }).catch(function(err) {
      reject(err);
    });
  });
}

describe('Integration', function() {
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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
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
        console.dir(e)
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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
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
});
