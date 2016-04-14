module.exports = {};

// Server exports
module.exports.ExpressRESTTransport = require('./server/express_rest_transport');
module.exports.SocketIOTransport = require('./server/socket_io_transport');
module.exports.Server = require('./server/server');

// // Client exports
// module.exports.client = {};
// module.exports.client.bson = {};
// module.exports.client.bson.Binary = require('./client/bson/binary');
// module.exports.client.bson.Code = require('./client/bson/code');
// module.exports.client.bson.DBRef = require('./client/bson/db_ref');
// module.exports.client.bson.Double = require('./client/bson/double');
// module.exports.client.bson.Long = require('./client/bson/long');
// module.exports.client.bson.MaxKey = require('./client/bson/max_key');
// module.exports.client.bson.MinKey = require('./client/bson/min_key');
// module.exports.client.bson.ObjectId = require('./client/bson/objectid');
// module.exports.client.bson.BSONRegExp = require('./client/bson/regexp');
// module.exports.client.bson.Symbol = require('./client/bson/symbol');
// module.exports.client.bson.Timestamp = require('./client/bson/timestamp');
//
// // Client transports and MongoClient
// module.exports.client.RESTTransport = require('./client/transports/rest_transport');
// module.exports.client.SocketIOTransport = require('./client/transports/socket_io_transport');
// module.exports.client.MongoClient = require('./client/mongo_client');
