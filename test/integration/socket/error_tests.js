var co = require('co'),
  path = require('path'),
  assert = require('assert'),
  f = require('util').format,
  SocketIOTransport = require('../../../server/socket_io_transport'),
  Server = require('../../../server/server'),
  Long = require('../../../client/bson/long'),
  MongoClient = require('mongodb').MongoClient;

// MongoDB Topology Manager
var ServerManager = require('mongodb-topology-manager').Server,
  ReplSetManager = require('mongodb-topology-manager').ReplSet;

// Get the client so we can simulate the Browser - Server connection
var MongoBrowserClient = require('../../../client/mongo_client'),
  SocketIOClientTransport = require('../../../client/transports/socket_io_transport'),
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
      mongoDBserver.registerTransport(new SocketIOTransport(httpServer));

      // Register channel handlers these are used to handle any data before it's passed through
      // to the mongodb handler
      mongoDBserver.createChannel('mongodb');

      // Listen to the http server
      httpServer.listen(9091, function() {
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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:9091');

        // Execute a command that does not exist and receive the error code
        try {
          var result = yield connectedClient.db('test').command({buildProfile:true});
        } catch(err) {
          assert.equal(0, err.code);
          assert.equal('command does not exits', err.message);
          assert.deepEqual({buildProfile:true}, err.op);
        }

        // Destroy MongoDB browser server
        mongoDBserver.destroy();
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop(9);

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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:9091');

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

        // Destroy MongoDB browser server
        mongoDBserver.destroy();
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop(9);

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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:9091');

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
        // Destroy MongoDB browser server
        mongoDBserver.destroy();
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop(9);

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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:9091');

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
        // Destroy MongoDB browser server
        mongoDBserver.destroy();
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop(9);

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });
});
