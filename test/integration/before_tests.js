var m = require('mongodb-version-manager');

before(function(done) {
  this.timeout(360 * 1000);

  // Kill any running MongoDB processes and
  // `install $MONGODB_VERSION` || `use existing installation` || `install stable`
  m(function(err){
    if(err) return console.error(err) && process.exit(1);

    m.current(function(err, version){
      if(err) return console.error(err) && process.exit(1);
      console.log('Running tests against MongoDB version `%s`', version);
      // Run the configuration
      done();
    });
  });
});

describe('Bootup', function() {
  it('respond with matching records', function() {
    return
  });
});
