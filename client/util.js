if(typeof window !== 'undefined') {
  var Promise = window.Promise || require('es6-promise').Promise;
} else if(typeof global !== 'undefined') {
  var Promise = global.Promise || require('es6-promise').Promise;
}

// BSON Types
var Long = require('./bson/long'),
  Binary = require('./bson/binary'),
  Code = require('./bson/code'),
  DBRef = require('./bson/db_ref'),
  Double = require('./bson/double'),
  MaxKey = require('./bson/max_key'),
  MinKey = require('./bson/min_key'),
  ObjectId = require('./bson/objectid'),
  BSONRegExp = require('./bson/regexp'),
  Symbol = require('./bson/symbol'),
  Timestamp = require('./bson/timestamp'),
  base64encode = require('./base64').encode;

var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
  draining = false;
  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }
  if (queue.length) {
    drainQueue();
  }
}

function drainQueue() {
  if(draining) {
    return;
  }

  var timeout = setTimeout(cleanUpNextTick);
  draining = true;

  var len = queue.length;
  while(len) {
    currentQueue = queue;
    queue = [];
    while (++queueIndex < len) {
        if (currentQueue) {
            currentQueue[queueIndex].run();
        }
    }
    queueIndex = -1;
    len = queue.length;
  }

  currentQueue = null;
  draining = false;
  clearTimeout(timeout);
}

var nextTick = function (fun) {
  var args = new Array(arguments.length - 1);

  if(arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }

  queue.push(new Item(fun, args));

  if(queue.length === 1 && !draining) {
    setTimeout(drainQueue, 0);
  }
};

// v8 likes predictible objects
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
Item.prototype.run = function () {
  this.fun.apply(null, this.array);
};

// Deflate
var inflate = function(doc) {
  var obj = {};

  for(var name in doc) {
    if(doc[name] instanceof Binary) {
      obj[name] = {
        $binary: base64encode(doc[name].buffer),
        $type: doc[name].sub_type.toString('hex')
      }
    } else if(doc[name] instanceof Date) {
      obj[name] = {
        $date: doc[name].toISOString()
      }
    } else if(doc[name] instanceof Timestamp) {
      obj[name] = {
        $timestamp: {
          t: doc[name].high_, i: doc[name].low_
        }
      }
    } else if(doc[name] instanceof BSONRegExp) {
      obj[name] = {
        $regexp: doc[name].pattern, $options: doc[name].options.join('')
      }
    } else if(doc[name] instanceof ObjectId) {
      obj[name] = {
        $oid: doc[name].toString()
      }
    } else if(doc[name] instanceof DBRef) {
      obj[name] = {
        $ref: doc[name].namespace,
        $id: doc[name].oid.toString()
      }
    } else if(doc[name] == 'undefined') {
      obj[name] = {
        $undefined: true
      }
    } else if(doc[name] instanceof MinKey) {
      obj[name] = {
        $minKey: 1
      }
    } else if(doc[name] instanceof MaxKey) {
      obj[name] = {
        $maxKey: 1
      }
    } else if(doc[name] instanceof Long) {
      obj[name] = {
        $numberLong: doc[name].toString()
      }
    } else if(doc[name] instanceof Code) {
      obj[name] = {
        $code: doc[name].code.toString(),
        $scope: inflate(doc[name].scope)
      }
    } else if(doc[name] instanceof Double) {
      obj[name] = {
        $double: doc[name].value
      }
    } else if(doc[name] instanceof Symbol) {
      obj[name] = {
        $symbol: doc[name].value
      }
    } else if(Array.isArray(doc[name])) {
      obj[name] = [];

      for(var i = 0; i < doc[name].length; i++) {
        obj[name][i] = inflate(doc[name][i]);
      }
    } else if(doc[name] != null && typeof doc[name] == 'object') {
      obj[name] = inflate(doc[name]);
    } else {
      obj[name] = doc[name];
    }
  }

  return obj;
}

module.exports = {
  Promise: Promise,
  nextTick: nextTick,
  inflate: inflate
};
