describe('Array', function() {
  describe('#indexOf()', function() {
    it('should simply connect to backend', function(done) {
      var MongoClient = window.mongodb.MongoClient,
        SocketIOTransport = window.mongodb.SocketIOTransport;
        console.log(window.mongodb)
      // Create an instance
      var client = new MongoClient(new SocketIOTransport(io, {}));

      // Connect to the db
      client.connect('http://localhost:8080').then(function(client) {
        client
          .db('test')
          .collection('tests')
          .insertOne({a:1}, {w:1}).then(function(r) {
            done();
          });
      });
    });
  });
});
