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

describe('Security', function() {
  describe('Reject', function() {
    it('reject command due to user not being authenticated single error', function(done) {
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

        // Register channel handlers these are used to handle any data before it's passed through
        // to the mongodb handler
        var channel = yield mongoDBserver.createChannel('mongodb');

        // Register before handler
        channel.before(function(conn, channel, data, callback) {
          callback(new Error('not authenticated'));
        });

        //
        // Client connection
        //
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Create an instance
        try {
          // Attempt to connect
          var connectedClient = yield client.connect('http://localhost:9091');
        } catch(e) {
          assert.equal('pre condition failed', e.message);
          assert.equal(false, e.ok);
          assert.equal(8, e.code);
          assert.deepEqual({ ismaster: true }, e.op);
          assert.deepEqual([ { message: 'not authenticated' } ], e.errors);

          // Destroy MongoDB browser server
          mongoDBserver.destroy();
          // Shut down the
          httpServer.close();
          // Shut down MongoDB connection
          dbClient.close();
          // Shut down MongoDB instance
          yield manager.stop(9);

          done();
        };
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('reject command due to user not being authenticated multiple errors', function(done) {
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

        // Register channel handlers these are used to handle any data before it's passed through
        // to the mongodb handler
        var channel = yield mongoDBserver.createChannel('mongodb');
        // Register before handler
        channel.before(function(conn, channel, data, callback) {
          callback([new Error('not authenticated'), new Error('some other error')]);
        });

        //
        // Client connection
        //
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Create an instance
        try {
          // Attempt to connect
          var connectedClient = yield client.connect('http://localhost:9091');
        } catch(e) {
          assert.equal('pre condition failed', e.message);
          assert.equal(false, e.ok);
          assert.equal(8, e.code);
          assert.deepEqual({ ismaster: true }, e.op);
          assert.deepEqual([ { message: 'not authenticated' }, { message: 'some other error' } ], e.errors);

          // Destroy MongoDB browser server
          mongoDBserver.destroy();
          // Shut down the
          httpServer.close();
          // Shut down MongoDB connection
          dbClient.close();
          // Shut down MongoDB instance
          yield manager.stop(9);

          done();
        };
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });
});
