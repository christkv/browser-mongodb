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
      mongoDBserver.channel('mongodb').before(function(conn, data, callback) {
        console.log("-------------------------- recevied mongodb channel message pre")
        console.dir(conn)
        callback();
      });

      // Register channel handlers these are used to handle any data before it's returned through
      // to the mongodb handler
      mongoDBserver.channel('mongodb').after(function(conn, data, callback) {
        console.log("-------------------------- recevied mongodb channel message post")
        console.dir(conn)
        callback();
      });

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

var waitMS = function(time) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve();
    }, time);
  });
}

describe('Integration', function() {
  describe('MongoDB Live Query', function() {
    it('correctly peform simple single document live query', function(done) {
      this.timeout(900000);

      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1'], replSet: 'test'
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //
        console.log("================================================== -4")

        var object = yield createServer({raw:true});
        var mongoDBserver = object.mongoDBserver;
        yield mongoDBserver.connect();

        var dbClient = object.client;
        var httpServer = object.httpServer;

        // Configure the replicaset
        var config = {_id: "test", members: [{_id: 0, host: "127.0.0.1:27017"}]};
        var result = yield dbClient.db('admin').command({ replSetInitiate: config });
        console.log("================================================== -3")

        // Wait for the server to go master
        while(true) {
          var result = yield dbClient.command({ismaster:true});
          if(result.ismaster) break;
          yield waitMS(100);
        }

        console.log("================================================== -2")

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');

        console.log("================================================== -1")
        process.nextTick(function() {
          co(function*() {
            var result = yield connectedClient.db('test').collection('tests').insertOne({a:1}, {w:1});
          });
        })

        // var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}], {w:1});
        // assert.equal(1, result.insertedCount);

        console.log("================================================== 0")
        // Iterate over all the cursors
        var cursor = connectedClient.db('test').collection('tests').find({a:1}).liveQuery();
        console.log("================================================== 1")
        cursor.on('added', function(id, fields) {
        });

        cursor.on('removed', function(id) {
        });

        cursor.on('changed', function(id, fields) {
          co(function*() {
            console.log("------------------------------------------ changed")
            console.dir(id)
            console.dir(fields)

            // Shut down the
            httpServer.close();
            // Shut down MongoDB connection
            dbClient.close();
            // Shut down MongoDB instance
            yield manager.stop();
            done();
          });
        });
        console.log("================================================== 2")

        // // Iteration, create more crap
        // var i = 0;
        //
        // // Wit for a little bit before forcing an oplog update
        // var interval = setInterval(function() {
        //   co(function*() {
        //     if(i == 16) clearInterval(interval);
        //     console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% UPDATE")
        //     // Perform a change event
        //     yield connectedClient.db('test').collection('tests').updateOne({a:1}, {$set: {b:i++}});
        //   });
        // }, 100);

        // Wit for a little bit before forcing an oplog update
        setTimeout(function() {
          co(function*() {
            yield connectedClient.db('test').collection('tests').updateOne({a:1}, {$set: {b:1}});
          });
        }, 100);

        // Execute the cursor activating the query listening
        var docs = yield cursor.toArray();
        console.log("================================================== 3")
      }).catch(function(e) {
        console.dir(e)
        console.log(e.stack)
      });
    });
  });
});
