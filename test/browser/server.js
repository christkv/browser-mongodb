var co = require('co'),
  path = require('path'),
  assert = require('assert'),
  fs = require('fs'),
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

var createServer = function() {
  return new Promise(function(resolve, reject) {
    co(function*() {
      var httpServer = require('http').createServer(function(req, res) {
        // console.log(f("grab url : %s", req.url));
        var file = '';
        var data = '';

        if(req.url == '/mongodb-browser-closure.js') {
          file = f('%s/../../dist/mongodb-browser.js', __dirname);
          data = fs.readFileSync(file);
        } else if(req.url == '/') {
          file = f('%s/index.htm', __dirname);
          data = fs.readFileSync(file);
        } else if(req.url.indexOf('favicon.ico') != -1) {
          data = '';
        } else {
          file = req.url.replace(/\//g, '');
          file = f('%s/%s', __dirname, file);
          data = fs.readFileSync(file);
        }

        res.end(data);
      });

      // Get the MongoClient
      var client = yield MongoClient.connect('mongodb://localhost:27017/test');
      // Add to the server
      var mongoDBserver = new Server(client, {});
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
        console.log("- listening to 8080");

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

co(function*() {
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
  });
});
