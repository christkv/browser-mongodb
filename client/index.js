// Export all the classes we want webpack to allow outside module scope
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
