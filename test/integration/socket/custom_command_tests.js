"use strict";

var co = require('co'),
  path = require('path'),
  assert = require('assert'),
  f = require('util').format,
  SocketIOTransport = require('../../../server/socket_io_transport'),
  Server = require('../../../server/server'),
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

describe('Integration', function() {
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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:9091');

        // Execute ping command
        var result = yield connectedClient.db('admin').command({ping:true});
        assert.equal(true, result.ok);

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
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:9091');

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
