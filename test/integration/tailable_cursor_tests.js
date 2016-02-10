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
  describe('MongoDB Tailable Cursor', function() {
    it('correctly execute tailable cursor', function(done) {
      this.timeout(20000);

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

        // Create the collection as a capped collection
        yield dbClient.db('test').createCollection('tests', {capped:true, size: 4500000});

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
        // Create documents
        var insertDocs = []; for(var i = 0; i < 105; i++) insertDocs.push({a:i});

        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany(insertDocs, {w:1});
        assert.equal(105, result.insertedCount);
        assert.equal(105, Object.keys(result.insertedIds).length);

        // Keep tab of all entries
        var total = 0
        // Configure tailable cursor
        var cursor = connectedClient.db('test')
          .collection('tests')
          .find({})
          .tailable()
          .maxTimeMS(100);

        cursor.on('data', function(data) {
          total = total + 1;
        })

        cursor.on('end', function() {
          co(function*() {
            assert.equal(205, total);
            // Shut down the
            httpServer.close();
            // Shut down MongoDB connection
            dbClient.close();
            // Shut down MongoDB instance
            yield manager.stop();
            done();
          });
        });

        // Generate new docs for the tailable cursor
        var counter = 0
        var execute = function() {
          co(function*() {
            yield dbClient.db('test').collection('tests').insertOne({a:1});
            counter = counter + 1;

            if(counter < 100) {
              setTimeout(execute, 1);
            }
          });
        }

        setTimeout(execute, 100);
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });
});
