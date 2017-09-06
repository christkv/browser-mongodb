// Export all the classes we want webpack to allow outside module scope
if(typeof window === 'undefined') {
  window = {};
}

window.mongodb = {}
window.mongodb.MongoClient = require('./mongo_client');
window.mongodb.Long = require('./bson/long');
window.mongodb.Binary = require('./bson/binary');
window.mongodb.Code = require('./bson/code');
window.mongodb.DBRef = require('./bson/db_ref');
window.mongodb.Dobule = require('./bson/double');
window.mongodb.MaxKey = require('./bson/max_key');
window.mongodb.MinKey = require('./bson/min_key');
window.mongodb.ObjectId = require('./bson/objectid');
window.mongodb.BSONRegExp = require('./bson/regexp');
window.mongodb.Symbol = require('./bson/symbol');
window.mongodb.Timestamp = require('./bson/timestamp');

// Available Transports
window.mongodb.SocketIOTransport = require('./transports/socket_io_transport');
window.mongodb.RESTTransport = require('./transports/rest_transport');

// Do we have a module
try {
  module.exports.MongoClient = require('./mongo_client');
  module.exports.Long = require('./bson/long');
  module.exports.Binary = require('./bson/binary');
  module.exports.Code = require('./bson/code');
  module.exports.DBRef = require('./bson/db_ref');
  module.exports.Dobule = require('./bson/double');
  module.exports.MaxKey = require('./bson/max_key');
  module.exports.MinKey = require('./bson/min_key');
  module.exports.ObjectId = require('./bson/objectid');
  module.exports.BSONRegExp = require('./bson/regexp');
  module.exports.Symbol = require('./bson/symbol');
  module.exports.Timestamp = require('./bson/timestamp');

  module.exports.SocketIOTransport = require('./transports/socket_io_transport');
  module.exports.RESTTransport = require('./transports/rest_transport');
} catch(e) {}
