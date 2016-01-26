/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	// Export all the classes we want webpack to allow outside module scope
	window.mongodb = {}
	window.mongodb.MongoClient = __webpack_require__(1);
	window.mongodb.Long = __webpack_require__(14);
	window.mongodb.Binary = __webpack_require__(15);
	window.mongodb.Code = __webpack_require__(16);
	window.mongodb.DBRef = __webpack_require__(17);
	window.mongodb.Dobule = __webpack_require__(18);
	window.mongodb.MaxKey = __webpack_require__(19);
	window.mongodb.MinKey = __webpack_require__(20);
	window.mongodb.ObjectId = __webpack_require__(21);
	window.mongodb.BSONRegExp = __webpack_require__(26);
	window.mongodb.Symbol = __webpack_require__(27);
	window.mongodb.Timestamp = __webpack_require__(28);

	// Available Transports
	window.mongodb.SocketIOTransport = __webpack_require__(41);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var Promise = __webpack_require__(2).Promise,
	  Callbacks = __webpack_require__(31),
	  MongoError = __webpack_require__(32),
	  Long = __webpack_require__(14),
	  ObjectId = __webpack_require__(21),
	  co = __webpack_require__(33),
	  deserializeFast = __webpack_require__(34).deserializeFast,
	  Db = __webpack_require__(35);

	var deserialize = function(obj) {
	  if(obj != null && typeof obj === 'object') {
	    for(var name in obj) {
	      if(obj[name] != null && obj[name]['$numberLong']) {
	        obj[name] = Long.fromString(obj[name]['$numberLong']);
	      } else if(obj[name] != null && obj[name]['$oid']) {
	        obj[name] = new ObjectId(obj[name]['$oid']);
	      } else if(obj[name] != null && typeof obj[name] === 'object') {
	        obj[name] = deserialize(obj[name]);
	      }
	    }
	  }

	  return obj;
	}

	class MongoClient {
	  constructor(transportFactory) {
	    this.transportFactory = transportFactory;
	    this.store = new Callbacks();
	  }

	  connect(url, channel, options) {
	    var self = this;
	    // Set the options
	    this.options = options || {}
	    // Use a custom channel or the default one
	    this.channel = channel || 'mongodb';

	    // Return the promise to allow for the connection
	    return new Promise(function(resolve, reject) {
	      co(function*() {
	        // Save the socket
	        self.transport = yield self.transportFactory.connect(url, options);

	        // Listen to all mongodb socket information
	        self.transport.onChannel(self.channel, function(data) {
	          // if(data.type) {
	          //   console.log("\n\n\n!!!!!!!!!!!!!!!!!!!!!!!!! Client received data")
	          //   console.dir(data)
	          // }

	          if(data.ok != null && !data.ok) {
	            self.store.call(data._id, new MongoError(data), undefined);
	          } else if(data.ok != null && data.ok && typeof data.type == 'string') {
	            self.store.update(deserialize(data));
	          } else if(data.ok != null && data.ok) {
	            if(data.result.length) {
	              data.result = deserializeFast(data.result);
	            } else {
	              data.result = deserialize(data.result);
	            }

	            // Result from a command
	            self.store.call(data._id, null, data);
	          }
	        });

	        self.transport.on('connect', function() {
	          co(function*() {
	            // Execute ismaster against server to determine abilites available
	            self.abilities = yield self.db('admin').command({ismaster:true});
	            // Resolve
	            resolve(self);
	          }).catch(function(err) {
	            reject(err);
	          });
	        });

	        self.transport.on('close', function() {
	          reject();
	        });

	        self.transport.on('error', function(e) {
	          reject(e);
	        });
	      }).catch(function(err) {
	        reject(err);
	      });
	    });
	  }

	  db(name) {
	    return new Db(name, this.channel, this.transport, this.store);
	  }
	}

	module.exports = MongoClient;


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {if(typeof window !== 'undefined') {
	  var Promise = window.Promise || __webpack_require__(3).Promise;
	} else if(typeof global !== 'undefined') {
	  var Promise = global.Promise || __webpack_require__(3).Promise;
	}

	// BSON Types
	var Long = __webpack_require__(14),
	  Binary = __webpack_require__(15),
	  Code = __webpack_require__(16),
	  DBRef = __webpack_require__(17),
	  Double = __webpack_require__(18),
	  MaxKey = __webpack_require__(19),
	  MinKey = __webpack_require__(20),
	  ObjectId = __webpack_require__(21),
	  BSONRegExp = __webpack_require__(26),
	  Symbol = __webpack_require__(27),
	  Timestamp = __webpack_require__(28),
	  base64encode = __webpack_require__(29).encode;

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
	var serialize = function(doc) {
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
	        $scope: serialize(doc[name].scope)
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
	        obj[name][i] = serialize(doc[name][i]);
	      }
	    } else if(doc[name] != null && typeof doc[name] == 'object') {
	      obj[name] = serialize(doc[name]);
	    } else {
	      obj[name] = doc[name];
	    }
	  }

	  return obj;
	}

	module.exports = {
	  Promise: Promise,
	  nextTick: nextTick,
	  serialize: serialize
	};

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var Promise = __webpack_require__(4).Promise;
	var polyfill = __webpack_require__(13).polyfill;
	exports.Promise = Promise;
	exports.polyfill = polyfill;

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var config = __webpack_require__(5).config;
	var configure = __webpack_require__(5).configure;
	var objectOrFunction = __webpack_require__(6).objectOrFunction;
	var isFunction = __webpack_require__(6).isFunction;
	var now = __webpack_require__(6).now;
	var all = __webpack_require__(7).all;
	var race = __webpack_require__(8).race;
	var staticResolve = __webpack_require__(9).resolve;
	var staticReject = __webpack_require__(10).reject;
	var asap = __webpack_require__(11).asap;

	var counter = 0;

	config.async = asap; // default async is asap;

	function Promise(resolver) {
	  if (!isFunction(resolver)) {
	    throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
	  }

	  if (!(this instanceof Promise)) {
	    throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
	  }

	  this._subscribers = [];

	  invokeResolver(resolver, this);
	}

	function invokeResolver(resolver, promise) {
	  function resolvePromise(value) {
	    resolve(promise, value);
	  }

	  function rejectPromise(reason) {
	    reject(promise, reason);
	  }

	  try {
	    resolver(resolvePromise, rejectPromise);
	  } catch(e) {
	    rejectPromise(e);
	  }
	}

	function invokeCallback(settled, promise, callback, detail) {
	  var hasCallback = isFunction(callback),
	      value, error, succeeded, failed;

	  if (hasCallback) {
	    try {
	      value = callback(detail);
	      succeeded = true;
	    } catch(e) {
	      failed = true;
	      error = e;
	    }
	  } else {
	    value = detail;
	    succeeded = true;
	  }

	  if (handleThenable(promise, value)) {
	    return;
	  } else if (hasCallback && succeeded) {
	    resolve(promise, value);
	  } else if (failed) {
	    reject(promise, error);
	  } else if (settled === FULFILLED) {
	    resolve(promise, value);
	  } else if (settled === REJECTED) {
	    reject(promise, value);
	  }
	}

	var PENDING   = void 0;
	var SEALED    = 0;
	var FULFILLED = 1;
	var REJECTED  = 2;

	function subscribe(parent, child, onFulfillment, onRejection) {
	  var subscribers = parent._subscribers;
	  var length = subscribers.length;

	  subscribers[length] = child;
	  subscribers[length + FULFILLED] = onFulfillment;
	  subscribers[length + REJECTED]  = onRejection;
	}

	function publish(promise, settled) {
	  var child, callback, subscribers = promise._subscribers, detail = promise._detail;

	  for (var i = 0; i < subscribers.length; i += 3) {
	    child = subscribers[i];
	    callback = subscribers[i + settled];

	    invokeCallback(settled, child, callback, detail);
	  }

	  promise._subscribers = null;
	}

	Promise.prototype = {
	  constructor: Promise,

	  _state: undefined,
	  _detail: undefined,
	  _subscribers: undefined,

	  then: function(onFulfillment, onRejection) {
	    var promise = this;

	    var thenPromise = new this.constructor(function() {});

	    if (this._state) {
	      var callbacks = arguments;
	      config.async(function invokePromiseCallback() {
	        invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
	      });
	    } else {
	      subscribe(this, thenPromise, onFulfillment, onRejection);
	    }

	    return thenPromise;
	  },

	  'catch': function(onRejection) {
	    return this.then(null, onRejection);
	  }
	};

	Promise.all = all;
	Promise.race = race;
	Promise.resolve = staticResolve;
	Promise.reject = staticReject;

	function handleThenable(promise, value) {
	  var then = null,
	  resolved;

	  try {
	    if (promise === value) {
	      throw new TypeError("A promises callback cannot return that same promise.");
	    }

	    if (objectOrFunction(value)) {
	      then = value.then;

	      if (isFunction(then)) {
	        then.call(value, function(val) {
	          if (resolved) { return true; }
	          resolved = true;

	          if (value !== val) {
	            resolve(promise, val);
	          } else {
	            fulfill(promise, val);
	          }
	        }, function(val) {
	          if (resolved) { return true; }
	          resolved = true;

	          reject(promise, val);
	        });

	        return true;
	      }
	    }
	  } catch (error) {
	    if (resolved) { return true; }
	    reject(promise, error);
	    return true;
	  }

	  return false;
	}

	function resolve(promise, value) {
	  if (promise === value) {
	    fulfill(promise, value);
	  } else if (!handleThenable(promise, value)) {
	    fulfill(promise, value);
	  }
	}

	function fulfill(promise, value) {
	  if (promise._state !== PENDING) { return; }
	  promise._state = SEALED;
	  promise._detail = value;

	  config.async(publishFulfillment, promise);
	}

	function reject(promise, reason) {
	  if (promise._state !== PENDING) { return; }
	  promise._state = SEALED;
	  promise._detail = reason;

	  config.async(publishRejection, promise);
	}

	function publishFulfillment(promise) {
	  publish(promise, promise._state = FULFILLED);
	}

	function publishRejection(promise) {
	  publish(promise, promise._state = REJECTED);
	}

	exports.Promise = Promise;

/***/ },
/* 5 */
/***/ function(module, exports) {

	"use strict";
	var config = {
	  instrument: false
	};

	function configure(name, value) {
	  if (arguments.length === 2) {
	    config[name] = value;
	  } else {
	    return config[name];
	  }
	}

	exports.config = config;
	exports.configure = configure;

/***/ },
/* 6 */
/***/ function(module, exports) {

	"use strict";
	function objectOrFunction(x) {
	  return isFunction(x) || (typeof x === "object" && x !== null);
	}

	function isFunction(x) {
	  return typeof x === "function";
	}

	function isArray(x) {
	  return Object.prototype.toString.call(x) === "[object Array]";
	}

	// Date.now is not available in browsers < IE9
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
	var now = Date.now || function() { return new Date().getTime(); };


	exports.objectOrFunction = objectOrFunction;
	exports.isFunction = isFunction;
	exports.isArray = isArray;
	exports.now = now;

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/* global toString */

	var isArray = __webpack_require__(6).isArray;
	var isFunction = __webpack_require__(6).isFunction;

	/**
	  Returns a promise that is fulfilled when all the given promises have been
	  fulfilled, or rejected if any of them become rejected. The return promise
	  is fulfilled with an array that gives all the values in the order they were
	  passed in the `promises` array argument.

	  Example:

	  ```javascript
	  var promise1 = RSVP.resolve(1);
	  var promise2 = RSVP.resolve(2);
	  var promise3 = RSVP.resolve(3);
	  var promises = [ promise1, promise2, promise3 ];

	  RSVP.all(promises).then(function(array){
	    // The array here would be [ 1, 2, 3 ];
	  });
	  ```

	  If any of the `promises` given to `RSVP.all` are rejected, the first promise
	  that is rejected will be given as an argument to the returned promises's
	  rejection handler. For example:

	  Example:

	  ```javascript
	  var promise1 = RSVP.resolve(1);
	  var promise2 = RSVP.reject(new Error("2"));
	  var promise3 = RSVP.reject(new Error("3"));
	  var promises = [ promise1, promise2, promise3 ];

	  RSVP.all(promises).then(function(array){
	    // Code here never runs because there are rejected promises!
	  }, function(error) {
	    // error.message === "2"
	  });
	  ```

	  @method all
	  @for RSVP
	  @param {Array} promises
	  @param {String} label
	  @return {Promise} promise that is fulfilled when all `promises` have been
	  fulfilled, or rejected if any of them become rejected.
	*/
	function all(promises) {
	  /*jshint validthis:true */
	  var Promise = this;

	  if (!isArray(promises)) {
	    throw new TypeError('You must pass an array to all.');
	  }

	  return new Promise(function(resolve, reject) {
	    var results = [], remaining = promises.length,
	    promise;

	    if (remaining === 0) {
	      resolve([]);
	    }

	    function resolver(index) {
	      return function(value) {
	        resolveAll(index, value);
	      };
	    }

	    function resolveAll(index, value) {
	      results[index] = value;
	      if (--remaining === 0) {
	        resolve(results);
	      }
	    }

	    for (var i = 0; i < promises.length; i++) {
	      promise = promises[i];

	      if (promise && isFunction(promise.then)) {
	        promise.then(resolver(i), reject);
	      } else {
	        resolveAll(i, promise);
	      }
	    }
	  });
	}

	exports.all = all;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	/* global toString */
	var isArray = __webpack_require__(6).isArray;

	/**
	  `RSVP.race` allows you to watch a series of promises and act as soon as the
	  first promise given to the `promises` argument fulfills or rejects.

	  Example:

	  ```javascript
	  var promise1 = new RSVP.Promise(function(resolve, reject){
	    setTimeout(function(){
	      resolve("promise 1");
	    }, 200);
	  });

	  var promise2 = new RSVP.Promise(function(resolve, reject){
	    setTimeout(function(){
	      resolve("promise 2");
	    }, 100);
	  });

	  RSVP.race([promise1, promise2]).then(function(result){
	    // result === "promise 2" because it was resolved before promise1
	    // was resolved.
	  });
	  ```

	  `RSVP.race` is deterministic in that only the state of the first completed
	  promise matters. For example, even if other promises given to the `promises`
	  array argument are resolved, but the first completed promise has become
	  rejected before the other promises became fulfilled, the returned promise
	  will become rejected:

	  ```javascript
	  var promise1 = new RSVP.Promise(function(resolve, reject){
	    setTimeout(function(){
	      resolve("promise 1");
	    }, 200);
	  });

	  var promise2 = new RSVP.Promise(function(resolve, reject){
	    setTimeout(function(){
	      reject(new Error("promise 2"));
	    }, 100);
	  });

	  RSVP.race([promise1, promise2]).then(function(result){
	    // Code here never runs because there are rejected promises!
	  }, function(reason){
	    // reason.message === "promise2" because promise 2 became rejected before
	    // promise 1 became fulfilled
	  });
	  ```

	  @method race
	  @for RSVP
	  @param {Array} promises array of promises to observe
	  @param {String} label optional string for describing the promise returned.
	  Useful for tooling.
	  @return {Promise} a promise that becomes fulfilled with the value the first
	  completed promises is resolved with if the first completed promise was
	  fulfilled, or rejected with the reason that the first completed promise
	  was rejected with.
	*/
	function race(promises) {
	  /*jshint validthis:true */
	  var Promise = this;

	  if (!isArray(promises)) {
	    throw new TypeError('You must pass an array to race.');
	  }
	  return new Promise(function(resolve, reject) {
	    var results = [], promise;

	    for (var i = 0; i < promises.length; i++) {
	      promise = promises[i];

	      if (promise && typeof promise.then === 'function') {
	        promise.then(resolve, reject);
	      } else {
	        resolve(promise);
	      }
	    }
	  });
	}

	exports.race = race;

/***/ },
/* 9 */
/***/ function(module, exports) {

	"use strict";
	function resolve(value) {
	  /*jshint validthis:true */
	  if (value && typeof value === 'object' && value.constructor === this) {
	    return value;
	  }

	  var Promise = this;

	  return new Promise(function(resolve) {
	    resolve(value);
	  });
	}

	exports.resolve = resolve;

/***/ },
/* 10 */
/***/ function(module, exports) {

	"use strict";
	/**
	  `RSVP.reject` returns a promise that will become rejected with the passed
	  `reason`. `RSVP.reject` is essentially shorthand for the following:

	  ```javascript
	  var promise = new RSVP.Promise(function(resolve, reject){
	    reject(new Error('WHOOPS'));
	  });

	  promise.then(function(value){
	    // Code here doesn't run because the promise is rejected!
	  }, function(reason){
	    // reason.message === 'WHOOPS'
	  });
	  ```

	  Instead of writing the above, your code now simply becomes the following:

	  ```javascript
	  var promise = RSVP.reject(new Error('WHOOPS'));

	  promise.then(function(value){
	    // Code here doesn't run because the promise is rejected!
	  }, function(reason){
	    // reason.message === 'WHOOPS'
	  });
	  ```

	  @method reject
	  @for RSVP
	  @param {Any} reason value that the returned promise will be rejected with.
	  @param {String} label optional string for identifying the returned promise.
	  Useful for tooling.
	  @return {Promise} a promise that will become rejected with the given
	  `reason`.
	*/
	function reject(reason) {
	  /*jshint validthis:true */
	  var Promise = this;

	  return new Promise(function (resolve, reject) {
	    reject(reason);
	  });
	}

	exports.reject = reject;

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, process) {"use strict";
	var browserGlobal = (typeof window !== 'undefined') ? window : {};
	var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
	var local = (typeof global !== 'undefined') ? global : (this === undefined? window:this);

	// node
	function useNextTick() {
	  return function() {
	    process.nextTick(flush);
	  };
	}

	function useMutationObserver() {
	  var iterations = 0;
	  var observer = new BrowserMutationObserver(flush);
	  var node = document.createTextNode('');
	  observer.observe(node, { characterData: true });

	  return function() {
	    node.data = (iterations = ++iterations % 2);
	  };
	}

	function useSetTimeout() {
	  return function() {
	    local.setTimeout(flush, 1);
	  };
	}

	var queue = [];
	function flush() {
	  for (var i = 0; i < queue.length; i++) {
	    var tuple = queue[i];
	    var callback = tuple[0], arg = tuple[1];
	    callback(arg);
	  }
	  queue = [];
	}

	var scheduleFlush;

	// Decide what async method to use to triggering processing of queued callbacks:
	if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
	  scheduleFlush = useNextTick();
	} else if (BrowserMutationObserver) {
	  scheduleFlush = useMutationObserver();
	} else {
	  scheduleFlush = useSetTimeout();
	}

	function asap(callback, arg) {
	  var length = queue.push([callback, arg]);
	  if (length === 1) {
	    // If length is 1, that means that we need to schedule an async flush.
	    // If additional callbacks are queued before the queue is flushed, they
	    // will be processed by this flush that we are scheduling.
	    scheduleFlush();
	  }
	}

	exports.asap = asap;
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(12)))

/***/ },
/* 12 */
/***/ function(module, exports) {

	// shim for using process in browser

	var process = module.exports = {};
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
	    if (draining) {
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

	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
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
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};

	function noop() {}

	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;

	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};

	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {"use strict";
	/*global self*/
	var RSVPPromise = __webpack_require__(4).Promise;
	var isFunction = __webpack_require__(6).isFunction;

	function polyfill() {
	  var local;

	  if (typeof global !== 'undefined') {
	    local = global;
	  } else if (typeof window !== 'undefined' && window.document) {
	    local = window;
	  } else {
	    local = self;
	  }

	  var es6PromiseSupport = 
	    "Promise" in local &&
	    // Some of these methods are missing from
	    // Firefox/Chrome experimental implementations
	    "resolve" in local.Promise &&
	    "reject" in local.Promise &&
	    "all" in local.Promise &&
	    "race" in local.Promise &&
	    // Older version of the spec had a resolver object
	    // as the arg rather than a function
	    (function() {
	      var resolve;
	      new local.Promise(function(r) { resolve = r; });
	      return isFunction(resolve);
	    }());

	  if (!es6PromiseSupport) {
	    local.Promise = RSVPPromise;
	  }
	}

	exports.polyfill = polyfill;
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 14 */
/***/ function(module, exports) {

	// Licensed under the Apache License, Version 2.0 (the "License");
	// you may not use this file except in compliance with the License.
	// You may obtain a copy of the License at
	//
	//     http://www.apache.org/licenses/LICENSE-2.0
	//
	// Unless required by applicable law or agreed to in writing, software
	// distributed under the License is distributed on an "AS IS" BASIS,
	// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	// See the License for the specific language governing permissions and
	// limitations under the License.
	//
	// Copyright 2009 Google Inc. All Rights Reserved

	/**
	 * Defines a Long class for representing a 64-bit two's-complement
	 * integer value, which faithfully simulates the behavior of a Java "Long". This
	 * implementation is derived from LongLib in GWT.
	 *
	 * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
	 * values as *signed* integers.  See the from* functions below for more
	 * convenient ways of constructing Longs.
	 *
	 * The internal representation of a Long is the two given signed, 32-bit values.
	 * We use 32-bit pieces because these are the size of integers on which
	 * Javascript performs bit-operations.  For operations like addition and
	 * multiplication, we split each number into 16-bit pieces, which can easily be
	 * multiplied within Javascript's floating-point representation without overflow
	 * or change in sign.
	 *
	 * In the algorithms below, we frequently reduce the negative case to the
	 * positive case by negating the input(s) and then post-processing the result.
	 * Note that we must ALWAYS check specially whether those values are MIN_VALUE
	 * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
	 * a positive number, it overflows back into a negative).  Not handling this
	 * case would often result in infinite recursion.
	 *
	 * @class
	 * @param {number} low  the low (signed) 32 bits of the Long.
	 * @param {number} high the high (signed) 32 bits of the Long.
	 * @return {Long}
	 */
	function Long(low, high) {
	  if(!(this instanceof Long)) return new Long(low, high);

	  this._bsontype = 'Long';
	  /**
	   * @type {number}
	   * @ignore
	   */
	  this.low_ = low | 0;  // force into 32 signed bits.

	  /**
	   * @type {number}
	   * @ignore
	   */
	  this.high_ = high | 0;  // force into 32 signed bits.
	};

	/**
	 * Return the int value.
	 *
	 * @method
	 * @return {number} the value, assuming it is a 32-bit integer.
	 */
	Long.prototype.toInt = function() {
	  return this.low_;
	};

	/**
	 * Return the Number value.
	 *
	 * @method
	 * @return {number} the closest floating-point representation to this value.
	 */
	Long.prototype.toNumber = function() {
	  return this.high_ * Long.TWO_PWR_32_DBL_ +
	         this.getLowBitsUnsigned();
	};

	/**
	 * Return the JSON value.
	 *
	 * @method
	 * @return {string} the JSON representation.
	 */
	Long.prototype.toJSON = function() {
	  return {"$numberLong": this.toString()};
	}

	/**
	 * Return the String value.
	 *
	 * @method
	 * @param {number} [opt_radix] the radix in which the text should be written.
	 * @return {string} the textual representation of this value.
	 */
	Long.prototype.toString = function(opt_radix) {
	  var radix = opt_radix || 10;
	  if (radix < 2 || 36 < radix) {
	    throw Error('radix out of range: ' + radix);
	  }

	  if (this.isZero()) {
	    return '0';
	  }

	  if (this.isNegative()) {
	    if (this.equals(Long.MIN_VALUE)) {
	      // We need to change the Long value before it can be negated, so we remove
	      // the bottom-most digit in this base and then recurse to do the rest.
	      var radixLong = Long.fromNumber(radix);
	      var div = this.div(radixLong);
	      var rem = div.multiply(radixLong).subtract(this);
	      return div.toString(radix) + rem.toInt().toString(radix);
	    } else {
	      return '-' + this.negate().toString(radix);
	    }
	  }

	  // Do several (6) digits each time through the loop, so as to
	  // minimize the calls to the very expensive emulated div.
	  var radixToPower = Long.fromNumber(Math.pow(radix, 6));

	  var rem = this;
	  var result = '';
	  while (true) {
	    var remDiv = rem.div(radixToPower);
	    var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
	    var digits = intval.toString(radix);

	    rem = remDiv;
	    if (rem.isZero()) {
	      return digits + result;
	    } else {
	      while (digits.length < 6) {
	        digits = '0' + digits;
	      }
	      result = '' + digits + result;
	    }
	  }
	};

	/**
	 * Return the high 32-bits value.
	 *
	 * @method
	 * @return {number} the high 32-bits as a signed value.
	 */
	Long.prototype.getHighBits = function() {
	  return this.high_;
	};

	/**
	 * Return the low 32-bits value.
	 *
	 * @method
	 * @return {number} the low 32-bits as a signed value.
	 */
	Long.prototype.getLowBits = function() {
	  return this.low_;
	};

	/**
	 * Return the low unsigned 32-bits value.
	 *
	 * @method
	 * @return {number} the low 32-bits as an unsigned value.
	 */
	Long.prototype.getLowBitsUnsigned = function() {
	  return (this.low_ >= 0) ?
	      this.low_ : Long.TWO_PWR_32_DBL_ + this.low_;
	};

	/**
	 * Returns the number of bits needed to represent the absolute value of this Long.
	 *
	 * @method
	 * @return {number} Returns the number of bits needed to represent the absolute value of this Long.
	 */
	Long.prototype.getNumBitsAbs = function() {
	  if (this.isNegative()) {
	    if (this.equals(Long.MIN_VALUE)) {
	      return 64;
	    } else {
	      return this.negate().getNumBitsAbs();
	    }
	  } else {
	    var val = this.high_ != 0 ? this.high_ : this.low_;
	    for (var bit = 31; bit > 0; bit--) {
	      if ((val & (1 << bit)) != 0) {
	        break;
	      }
	    }
	    return this.high_ != 0 ? bit + 33 : bit + 1;
	  }
	};

	/**
	 * Return whether this value is zero.
	 *
	 * @method
	 * @return {boolean} whether this value is zero.
	 */
	Long.prototype.isZero = function() {
	  return this.high_ == 0 && this.low_ == 0;
	};

	/**
	 * Return whether this value is negative.
	 *
	 * @method
	 * @return {boolean} whether this value is negative.
	 */
	Long.prototype.isNegative = function() {
	  return this.high_ < 0;
	};

	/**
	 * Return whether this value is odd.
	 *
	 * @method
	 * @return {boolean} whether this value is odd.
	 */
	Long.prototype.isOdd = function() {
	  return (this.low_ & 1) == 1;
	};

	/**
	 * Return whether this Long equals the other
	 *
	 * @method
	 * @param {Long} other Long to compare against.
	 * @return {boolean} whether this Long equals the other
	 */
	Long.prototype.equals = function(other) {
	  return (this.high_ == other.high_) && (this.low_ == other.low_);
	};

	/**
	 * Return whether this Long does not equal the other.
	 *
	 * @method
	 * @param {Long} other Long to compare against.
	 * @return {boolean} whether this Long does not equal the other.
	 */
	Long.prototype.notEquals = function(other) {
	  return (this.high_ != other.high_) || (this.low_ != other.low_);
	};

	/**
	 * Return whether this Long is less than the other.
	 *
	 * @method
	 * @param {Long} other Long to compare against.
	 * @return {boolean} whether this Long is less than the other.
	 */
	Long.prototype.lessThan = function(other) {
	  return this.compare(other) < 0;
	};

	/**
	 * Return whether this Long is less than or equal to the other.
	 *
	 * @method
	 * @param {Long} other Long to compare against.
	 * @return {boolean} whether this Long is less than or equal to the other.
	 */
	Long.prototype.lessThanOrEqual = function(other) {
	  return this.compare(other) <= 0;
	};

	/**
	 * Return whether this Long is greater than the other.
	 *
	 * @method
	 * @param {Long} other Long to compare against.
	 * @return {boolean} whether this Long is greater than the other.
	 */
	Long.prototype.greaterThan = function(other) {
	  return this.compare(other) > 0;
	};

	/**
	 * Return whether this Long is greater than or equal to the other.
	 *
	 * @method
	 * @param {Long} other Long to compare against.
	 * @return {boolean} whether this Long is greater than or equal to the other.
	 */
	Long.prototype.greaterThanOrEqual = function(other) {
	  return this.compare(other) >= 0;
	};

	/**
	 * Compares this Long with the given one.
	 *
	 * @method
	 * @param {Long} other Long to compare against.
	 * @return {boolean} 0 if they are the same, 1 if the this is greater, and -1 if the given one is greater.
	 */
	Long.prototype.compare = function(other) {
	  if (this.equals(other)) {
	    return 0;
	  }

	  var thisNeg = this.isNegative();
	  var otherNeg = other.isNegative();
	  if (thisNeg && !otherNeg) {
	    return -1;
	  }
	  if (!thisNeg && otherNeg) {
	    return 1;
	  }

	  // at this point, the signs are the same, so subtraction will not overflow
	  if (this.subtract(other).isNegative()) {
	    return -1;
	  } else {
	    return 1;
	  }
	};

	/**
	 * The negation of this value.
	 *
	 * @method
	 * @return {Long} the negation of this value.
	 */
	Long.prototype.negate = function() {
	  if (this.equals(Long.MIN_VALUE)) {
	    return Long.MIN_VALUE;
	  } else {
	    return this.not().add(Long.ONE);
	  }
	};

	/**
	 * Returns the sum of this and the given Long.
	 *
	 * @method
	 * @param {Long} other Long to add to this one.
	 * @return {Long} the sum of this and the given Long.
	 */
	Long.prototype.add = function(other) {
	  // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

	  var a48 = this.high_ >>> 16;
	  var a32 = this.high_ & 0xFFFF;
	  var a16 = this.low_ >>> 16;
	  var a00 = this.low_ & 0xFFFF;

	  var b48 = other.high_ >>> 16;
	  var b32 = other.high_ & 0xFFFF;
	  var b16 = other.low_ >>> 16;
	  var b00 = other.low_ & 0xFFFF;

	  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
	  c00 += a00 + b00;
	  c16 += c00 >>> 16;
	  c00 &= 0xFFFF;
	  c16 += a16 + b16;
	  c32 += c16 >>> 16;
	  c16 &= 0xFFFF;
	  c32 += a32 + b32;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c48 += a48 + b48;
	  c48 &= 0xFFFF;
	  return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
	};

	/**
	 * Returns the difference of this and the given Long.
	 *
	 * @method
	 * @param {Long} other Long to subtract from this.
	 * @return {Long} the difference of this and the given Long.
	 */
	Long.prototype.subtract = function(other) {
	  return this.add(other.negate());
	};

	/**
	 * Returns the product of this and the given Long.
	 *
	 * @method
	 * @param {Long} other Long to multiply with this.
	 * @return {Long} the product of this and the other.
	 */
	Long.prototype.multiply = function(other) {
	  if (this.isZero()) {
	    return Long.ZERO;
	  } else if (other.isZero()) {
	    return Long.ZERO;
	  }

	  if (this.equals(Long.MIN_VALUE)) {
	    return other.isOdd() ? Long.MIN_VALUE : Long.ZERO;
	  } else if (other.equals(Long.MIN_VALUE)) {
	    return this.isOdd() ? Long.MIN_VALUE : Long.ZERO;
	  }

	  if (this.isNegative()) {
	    if (other.isNegative()) {
	      return this.negate().multiply(other.negate());
	    } else {
	      return this.negate().multiply(other).negate();
	    }
	  } else if (other.isNegative()) {
	    return this.multiply(other.negate()).negate();
	  }

	  // If both Longs are small, use float multiplication
	  if (this.lessThan(Long.TWO_PWR_24_) &&
	      other.lessThan(Long.TWO_PWR_24_)) {
	    return Long.fromNumber(this.toNumber() * other.toNumber());
	  }

	  // Divide each Long into 4 chunks of 16 bits, and then add up 4x4 products.
	  // We can skip products that would overflow.

	  var a48 = this.high_ >>> 16;
	  var a32 = this.high_ & 0xFFFF;
	  var a16 = this.low_ >>> 16;
	  var a00 = this.low_ & 0xFFFF;

	  var b48 = other.high_ >>> 16;
	  var b32 = other.high_ & 0xFFFF;
	  var b16 = other.low_ >>> 16;
	  var b00 = other.low_ & 0xFFFF;

	  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
	  c00 += a00 * b00;
	  c16 += c00 >>> 16;
	  c00 &= 0xFFFF;
	  c16 += a16 * b00;
	  c32 += c16 >>> 16;
	  c16 &= 0xFFFF;
	  c16 += a00 * b16;
	  c32 += c16 >>> 16;
	  c16 &= 0xFFFF;
	  c32 += a32 * b00;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c32 += a16 * b16;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c32 += a00 * b32;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
	  c48 &= 0xFFFF;
	  return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
	};

	/**
	 * Returns this Long divided by the given one.
	 *
	 * @method
	 * @param {Long} other Long by which to divide.
	 * @return {Long} this Long divided by the given one.
	 */
	Long.prototype.div = function(other) {
	  if (other.isZero()) {
	    throw Error('division by zero');
	  } else if (this.isZero()) {
	    return Long.ZERO;
	  }

	  if (this.equals(Long.MIN_VALUE)) {
	    if (other.equals(Long.ONE) ||
	        other.equals(Long.NEG_ONE)) {
	      return Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
	    } else if (other.equals(Long.MIN_VALUE)) {
	      return Long.ONE;
	    } else {
	      // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
	      var halfThis = this.shiftRight(1);
	      var approx = halfThis.div(other).shiftLeft(1);
	      if (approx.equals(Long.ZERO)) {
	        return other.isNegative() ? Long.ONE : Long.NEG_ONE;
	      } else {
	        var rem = this.subtract(other.multiply(approx));
	        var result = approx.add(rem.div(other));
	        return result;
	      }
	    }
	  } else if (other.equals(Long.MIN_VALUE)) {
	    return Long.ZERO;
	  }

	  if (this.isNegative()) {
	    if (other.isNegative()) {
	      return this.negate().div(other.negate());
	    } else {
	      return this.negate().div(other).negate();
	    }
	  } else if (other.isNegative()) {
	    return this.div(other.negate()).negate();
	  }

	  // Repeat the following until the remainder is less than other:  find a
	  // floating-point that approximates remainder / other *from below*, add this
	  // into the result, and subtract it from the remainder.  It is critical that
	  // the approximate value is less than or equal to the real value so that the
	  // remainder never becomes negative.
	  var res = Long.ZERO;
	  var rem = this;
	  while (rem.greaterThanOrEqual(other)) {
	    // Approximate the result of division. This may be a little greater or
	    // smaller than the actual value.
	    var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

	    // We will tweak the approximate result by changing it in the 48-th digit or
	    // the smallest non-fractional digit, whichever is larger.
	    var log2 = Math.ceil(Math.log(approx) / Math.LN2);
	    var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

	    // Decrease the approximation until it is smaller than the remainder.  Note
	    // that if it is too large, the product overflows and is negative.
	    var approxRes = Long.fromNumber(approx);
	    var approxRem = approxRes.multiply(other);
	    while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
	      approx -= delta;
	      approxRes = Long.fromNumber(approx);
	      approxRem = approxRes.multiply(other);
	    }

	    // We know the answer can't be zero... and actually, zero would cause
	    // infinite recursion since we would make no progress.
	    if (approxRes.isZero()) {
	      approxRes = Long.ONE;
	    }

	    res = res.add(approxRes);
	    rem = rem.subtract(approxRem);
	  }
	  return res;
	};

	/**
	 * Returns this Long modulo the given one.
	 *
	 * @method
	 * @param {Long} other Long by which to mod.
	 * @return {Long} this Long modulo the given one.
	 */
	Long.prototype.modulo = function(other) {
	  return this.subtract(this.div(other).multiply(other));
	};

	/**
	 * The bitwise-NOT of this value.
	 *
	 * @method
	 * @return {Long} the bitwise-NOT of this value.
	 */
	Long.prototype.not = function() {
	  return Long.fromBits(~this.low_, ~this.high_);
	};

	/**
	 * Returns the bitwise-AND of this Long and the given one.
	 *
	 * @method
	 * @param {Long} other the Long with which to AND.
	 * @return {Long} the bitwise-AND of this and the other.
	 */
	Long.prototype.and = function(other) {
	  return Long.fromBits(this.low_ & other.low_, this.high_ & other.high_);
	};

	/**
	 * Returns the bitwise-OR of this Long and the given one.
	 *
	 * @method
	 * @param {Long} other the Long with which to OR.
	 * @return {Long} the bitwise-OR of this and the other.
	 */
	Long.prototype.or = function(other) {
	  return Long.fromBits(this.low_ | other.low_, this.high_ | other.high_);
	};

	/**
	 * Returns the bitwise-XOR of this Long and the given one.
	 *
	 * @method
	 * @param {Long} other the Long with which to XOR.
	 * @return {Long} the bitwise-XOR of this and the other.
	 */
	Long.prototype.xor = function(other) {
	  return Long.fromBits(this.low_ ^ other.low_, this.high_ ^ other.high_);
	};

	/**
	 * Returns this Long with bits shifted to the left by the given amount.
	 *
	 * @method
	 * @param {number} numBits the number of bits by which to shift.
	 * @return {Long} this shifted to the left by the given amount.
	 */
	Long.prototype.shiftLeft = function(numBits) {
	  numBits &= 63;
	  if (numBits == 0) {
	    return this;
	  } else {
	    var low = this.low_;
	    if (numBits < 32) {
	      var high = this.high_;
	      return Long.fromBits(
	                 low << numBits,
	                 (high << numBits) | (low >>> (32 - numBits)));
	    } else {
	      return Long.fromBits(0, low << (numBits - 32));
	    }
	  }
	};

	/**
	 * Returns this Long with bits shifted to the right by the given amount.
	 *
	 * @method
	 * @param {number} numBits the number of bits by which to shift.
	 * @return {Long} this shifted to the right by the given amount.
	 */
	Long.prototype.shiftRight = function(numBits) {
	  numBits &= 63;
	  if (numBits == 0) {
	    return this;
	  } else {
	    var high = this.high_;
	    if (numBits < 32) {
	      var low = this.low_;
	      return Long.fromBits(
	                 (low >>> numBits) | (high << (32 - numBits)),
	                 high >> numBits);
	    } else {
	      return Long.fromBits(
	                 high >> (numBits - 32),
	                 high >= 0 ? 0 : -1);
	    }
	  }
	};

	/**
	 * Returns this Long with bits shifted to the right by the given amount, with the new top bits matching the current sign bit.
	 *
	 * @method
	 * @param {number} numBits the number of bits by which to shift.
	 * @return {Long} this shifted to the right by the given amount, with zeros placed into the new leading bits.
	 */
	Long.prototype.shiftRightUnsigned = function(numBits) {
	  numBits &= 63;
	  if (numBits == 0) {
	    return this;
	  } else {
	    var high = this.high_;
	    if (numBits < 32) {
	      var low = this.low_;
	      return Long.fromBits(
	                 (low >>> numBits) | (high << (32 - numBits)),
	                 high >>> numBits);
	    } else if (numBits == 32) {
	      return Long.fromBits(high, 0);
	    } else {
	      return Long.fromBits(high >>> (numBits - 32), 0);
	    }
	  }
	};

	/**
	 * Returns a Long representing the given (32-bit) integer value.
	 *
	 * @method
	 * @param {number} value the 32-bit integer in question.
	 * @return {Long} the corresponding Long value.
	 */
	Long.fromInt = function(value) {
	  if (-128 <= value && value < 128) {
	    var cachedObj = Long.INT_CACHE_[value];
	    if (cachedObj) {
	      return cachedObj;
	    }
	  }

	  var obj = new Long(value | 0, value < 0 ? -1 : 0);
	  if (-128 <= value && value < 128) {
	    Long.INT_CACHE_[value] = obj;
	  }
	  return obj;
	};

	/**
	 * Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
	 *
	 * @method
	 * @param {number} value the number in question.
	 * @return {Long} the corresponding Long value.
	 */
	Long.fromNumber = function(value) {
	  if (isNaN(value) || !isFinite(value)) {
	    return Long.ZERO;
	  } else if (value <= -Long.TWO_PWR_63_DBL_) {
	    return Long.MIN_VALUE;
	  } else if (value + 1 >= Long.TWO_PWR_63_DBL_) {
	    return Long.MAX_VALUE;
	  } else if (value < 0) {
	    return Long.fromNumber(-value).negate();
	  } else {
	    return new Long(
	               (value % Long.TWO_PWR_32_DBL_) | 0,
	               (value / Long.TWO_PWR_32_DBL_) | 0);
	  }
	};

	/**
	 * Returns a Long representing the 64-bit integer that comes by concatenating the given high and low bits. Each is assumed to use 32 bits.
	 *
	 * @method
	 * @param {number} lowBits the low 32-bits.
	 * @param {number} highBits the high 32-bits.
	 * @return {Long} the corresponding Long value.
	 */
	Long.fromBits = function(lowBits, highBits) {
	  return new Long(lowBits, highBits);
	};

	/**
	 * Returns a Long representation of the given string, written using the given radix.
	 *
	 * @method
	 * @param {string} str the textual representation of the Long.
	 * @param {number} opt_radix the radix in which the text is written.
	 * @return {Long} the corresponding Long value.
	 */
	Long.fromString = function(str, opt_radix) {
	  if (str.length == 0) {
	    throw Error('number format error: empty string');
	  }

	  var radix = opt_radix || 10;
	  if (radix < 2 || 36 < radix) {
	    throw Error('radix out of range: ' + radix);
	  }

	  if (str.charAt(0) == '-') {
	    return Long.fromString(str.substring(1), radix).negate();
	  } else if (str.indexOf('-') >= 0) {
	    throw Error('number format error: interior "-" character: ' + str);
	  }

	  // Do several (8) digits each time through the loop, so as to
	  // minimize the calls to the very expensive emulated div.
	  var radixToPower = Long.fromNumber(Math.pow(radix, 8));

	  var result = Long.ZERO;
	  for (var i = 0; i < str.length; i += 8) {
	    var size = Math.min(8, str.length - i);
	    var value = parseInt(str.substring(i, i + size), radix);
	    if (size < 8) {
	      var power = Long.fromNumber(Math.pow(radix, size));
	      result = result.multiply(power).add(Long.fromNumber(value));
	    } else {
	      result = result.multiply(radixToPower);
	      result = result.add(Long.fromNumber(value));
	    }
	  }
	  return result;
	};

	// NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
	// from* methods on which they depend.


	/**
	 * A cache of the Long representations of small integer values.
	 * @type {Object}
	 * @ignore
	 */
	Long.INT_CACHE_ = {};

	// NOTE: the compiler should inline these constant values below and then remove
	// these variables, so there should be no runtime penalty for these.

	/**
	 * Number used repeated below in calculations.  This must appear before the
	 * first call to any from* function below.
	 * @type {number}
	 * @ignore
	 */
	Long.TWO_PWR_16_DBL_ = 1 << 16;

	/**
	 * @type {number}
	 * @ignore
	 */
	Long.TWO_PWR_24_DBL_ = 1 << 24;

	/**
	 * @type {number}
	 * @ignore
	 */
	Long.TWO_PWR_32_DBL_ = Long.TWO_PWR_16_DBL_ * Long.TWO_PWR_16_DBL_;

	/**
	 * @type {number}
	 * @ignore
	 */
	Long.TWO_PWR_31_DBL_ = Long.TWO_PWR_32_DBL_ / 2;

	/**
	 * @type {number}
	 * @ignore
	 */
	Long.TWO_PWR_48_DBL_ = Long.TWO_PWR_32_DBL_ * Long.TWO_PWR_16_DBL_;

	/**
	 * @type {number}
	 * @ignore
	 */
	Long.TWO_PWR_64_DBL_ = Long.TWO_PWR_32_DBL_ * Long.TWO_PWR_32_DBL_;

	/**
	 * @type {number}
	 * @ignore
	 */
	Long.TWO_PWR_63_DBL_ = Long.TWO_PWR_64_DBL_ / 2;

	/** @type {Long} */
	Long.ZERO = Long.fromInt(0);

	/** @type {Long} */
	Long.ONE = Long.fromInt(1);

	/** @type {Long} */
	Long.NEG_ONE = Long.fromInt(-1);

	/** @type {Long} */
	Long.MAX_VALUE =
	    Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);

	/** @type {Long} */
	Long.MIN_VALUE = Long.fromBits(0, 0x80000000 | 0);

	/**
	 * @type {Long}
	 * @ignore
	 */
	Long.TWO_PWR_24_ = Long.fromInt(1 << 24);

	/**
	 * Expose.
	 */
	module.exports = Long;
	module.exports.Long = Long;


/***/ },
/* 15 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON Binary type.
	 *
	 * Sub types
	 *  - **BSON.BSON_BINARY_SUBTYPE_DEFAULT**, default BSON type.
	 *  - **BSON.BSON_BINARY_SUBTYPE_FUNCTION**, BSON function type.
	 *  - **BSON.BSON_BINARY_SUBTYPE_BYTE_ARRAY**, BSON byte array type.
	 *  - **BSON.BSON_BINARY_SUBTYPE_UUID**, BSON uuid type.
	 *  - **BSON.BSON_BINARY_SUBTYPE_MD5**, BSON md5 type.
	 *  - **BSON.BSON_BINARY_SUBTYPE_USER_DEFINED**, BSON user defined type.
	 *
	 * @class
	 * @param {Buffer} buffer a buffer object containing the binary data.
	 * @param {Number} [subType] the option binary type.
	 * @return {Binary}
	 */
	function Binary(buffer, subType) {
	  if(!(this instanceof Binary)) return new Binary(buffer, subType);

	  this._bsontype = 'Binary';

	  if(buffer instanceof Number) {
	    this.sub_type = buffer;
	    this.position = 0;
	  } else {
	    this.sub_type = subType == null ? BSON_BINARY_SUBTYPE_DEFAULT : subType;
	    this.position = 0;
	  }

	  if(buffer != null && !(buffer instanceof Number)) {
	    // Only accept Uint8Array or Arrays
	    if(typeof buffer == 'string') {
	      // Different ways of writing the length of the string for the different types
	      if(typeof Uint8Array != 'undefined' || (Object.prototype.toString.call(buffer) == '[object Array]')) {
	        this.buffer = writeStringToArray(buffer);
	      } else {
	        throw new Error("only String, Uint8Array or Array accepted");
	      }
	    } else {
	      this.buffer = buffer;
	    }
	    this.position = buffer.length;
	  } else {
	    if(typeof Uint8Array != 'undefined'){
	      this.buffer = new Uint8Array(new ArrayBuffer(Binary.BUFFER_SIZE));
	    } else {
	      this.buffer = new Array(Binary.BUFFER_SIZE);
	    }
	    // Set position to start of buffer
	    this.position = 0;
	  }
	};

	/**
	 * Updates this binary with byte_value.
	 *
	 * @method
	 * @param {string} byte_value a single byte we wish to write.
	 */
	Binary.prototype.put = function put(byte_value) {
	  // If it's a string and a has more than one character throw an error
	  if(byte_value['length'] != null && typeof byte_value != 'number' && byte_value.length != 1) throw new Error("only accepts single character String, Uint8Array or Array");
	  if(typeof byte_value != 'number' && byte_value < 0 || byte_value > 255) throw new Error("only accepts number in a valid unsigned byte range 0-255");

	  // Decode the byte value once
	  var decoded_byte = null;
	  if(typeof byte_value == 'string') {
	    decoded_byte = byte_value.charCodeAt(0);
	  } else if(byte_value['length'] != null) {
	    decoded_byte = byte_value[0];
	  } else {
	    decoded_byte = byte_value;
	  }

	  if(this.buffer.length > this.position) {
	    this.buffer[this.position++] = decoded_byte;
	  } else {
	    var buffer = null;
	    // Create a new buffer (typed or normal array)
	    if(Object.prototype.toString.call(this.buffer) == '[object Uint8Array]') {
	      buffer = new Uint8Array(new ArrayBuffer(Binary.BUFFER_SIZE + this.buffer.length));
	    } else {
	      buffer = new Array(Binary.BUFFER_SIZE + this.buffer.length);
	    }

	    // We need to copy all the content to the new array
	    for(var i = 0; i < this.buffer.length; i++) {
	      buffer[i] = this.buffer[i];
	    }

	    // Reassign the buffer
	    this.buffer = buffer;
	    // Write the byte
	    this.buffer[this.position++] = decoded_byte;
	  }
	};

	/**
	 * Writes a buffer or string to the binary.
	 *
	 * @method
	 * @param {(Buffer|string)} string a string or buffer to be written to the Binary BSON object.
	 * @param {number} offset specify the binary of where to write the content.
	 * @return {null}
	 */
	Binary.prototype.write = function write(string, offset) {
	  offset = typeof offset == 'number' ? offset : this.position;

	  // If the buffer is to small let's extend the buffer
	  if(this.buffer.length < offset + string.length) {
	    var buffer = null;
	    // If we are in node.js
	    if(Object.prototype.toString.call(this.buffer) == '[object Uint8Array]') {
	      // Create a new buffer
	      buffer = new Uint8Array(new ArrayBuffer(this.buffer.length + string.length))
	      // Copy the content
	      for(var i = 0; i < this.position; i++) {
	        buffer[i] = this.buffer[i];
	      }
	    }

	    // Assign the new buffer
	    this.buffer = buffer;
	  }

	  if(Object.prototype.toString.call(string) == '[object Uint8Array]'
	    || Object.prototype.toString.call(string) == '[object Array]' && typeof string != 'string') {
	    for(var i = 0; i < string.length; i++) {
	      this.buffer[offset++] = string[i];
	    }

	    this.position = offset > this.position ? offset : this.position;
	  } else if(typeof string == 'string') {
	    for(var i = 0; i < string.length; i++) {
	      this.buffer[offset++] = string.charCodeAt(i);
	    }

	    this.position = offset > this.position ? offset : this.position;
	  }
	};

	/**
	 * Reads **length** bytes starting at **position**.
	 *
	 * @method
	 * @param {number} position read from the given position in the Binary.
	 * @param {number} length the number of bytes to read.
	 * @return {Buffer}
	 */
	Binary.prototype.read = function read(position, length) {
	  length = length && length > 0
	    ? length
	    : this.position;

	  // Let's return the data based on the type we have
	  if(this.buffer['slice']) {
	    return this.buffer.slice(position, position + length);
	  } else {
	    // Create a buffer to keep the result
	    var buffer = typeof Uint8Array != 'undefined' ? new Uint8Array(new ArrayBuffer(length)) : new Array(length);
	    for(var i = 0; i < length; i++) {
	      buffer[i] = this.buffer[position++];
	    }
	  }
	  // Return the buffer
	  return buffer;
	};

	/**
	 * Returns the value of this binary as a string.
	 *
	 * @method
	 * @return {string}
	 */
	Binary.prototype.value = function value(asRaw) {
	  asRaw = asRaw == null ? false : asRaw;

	  // If it's a node.js buffer object
	  if(asRaw) {
	    // we support the slice command use it
	    if(this.buffer['slice'] != null) {
	      return this.buffer.slice(0, this.position);
	    } else {
	      // Create a new buffer to copy content to
	      var newBuffer = Object.prototype.toString.call(this.buffer) == '[object Uint8Array]' ? new Uint8Array(new ArrayBuffer(this.position)) : new Array(this.position);
	      // Copy content
	      for(var i = 0; i < this.position; i++) {
	        newBuffer[i] = this.buffer[i];
	      }
	      // Return the buffer
	      return newBuffer;
	    }
	  } else {
	    return convertArraytoUtf8BinaryString(this.buffer, 0, this.position);
	  }
	};

	/**
	 * Length.
	 *
	 * @method
	 * @return {number} the length of the binary.
	 */
	Binary.prototype.length = function length() {
	  return this.position;
	};

	/**
	 * @ignore
	 */
	Binary.prototype.toJSON = function() {
	  return this.buffer != null ? this.buffer.toString('base64') : '';
	}

	/**
	 * @ignore
	 */
	Binary.prototype.toString = function(format) {
	  return this.buffer != null ? this.buffer.slice(0, this.position).toString(format) : '';
	}

	/**
	 * Binary default subtype
	 * @ignore
	 */
	var BSON_BINARY_SUBTYPE_DEFAULT = 0;

	/**
	 * @ignore
	 */
	var writeStringToArray = function(data) {
	  // Create a buffer
	  var buffer = typeof Uint8Array != 'undefined' ? new Uint8Array(new ArrayBuffer(data.length)) : new Array(data.length);
	  // Write the content to the buffer
	  for(var i = 0; i < data.length; i++) {
	    buffer[i] = data.charCodeAt(i);
	  }
	  // Write the string to the buffer
	  return buffer;
	}

	/**
	 * Convert Array ot Uint8Array to Binary String
	 *
	 * @ignore
	 */
	var convertArraytoUtf8BinaryString = function(byteArray, startIndex, endIndex) {
	  var result = "";
	  for(var i = startIndex; i < endIndex; i++) {
	   result = result + String.fromCharCode(byteArray[i]);
	  }
	  return result;
	};

	Binary.BUFFER_SIZE = 256;

	/**
	 * Default BSON type
	 *
	 * @classconstant SUBTYPE_DEFAULT
	 **/
	Binary.SUBTYPE_DEFAULT = 0;
	/**
	 * Function BSON type
	 *
	 * @classconstant SUBTYPE_DEFAULT
	 **/
	Binary.SUBTYPE_FUNCTION = 1;
	/**
	 * Byte Array BSON type
	 *
	 * @classconstant SUBTYPE_DEFAULT
	 **/
	Binary.SUBTYPE_BYTE_ARRAY = 2;
	/**
	 * OLD UUID BSON type
	 *
	 * @classconstant SUBTYPE_DEFAULT
	 **/
	Binary.SUBTYPE_UUID_OLD = 3;
	/**
	 * UUID BSON type
	 *
	 * @classconstant SUBTYPE_DEFAULT
	 **/
	Binary.SUBTYPE_UUID = 4;
	/**
	 * MD5 BSON type
	 *
	 * @classconstant SUBTYPE_DEFAULT
	 **/
	Binary.SUBTYPE_MD5 = 5;
	/**
	 * User BSON type
	 *
	 * @classconstant SUBTYPE_DEFAULT
	 **/
	Binary.SUBTYPE_USER_DEFINED = 128;

	/**
	 * Expose.
	 */
	module.exports = Binary;
	module.exports.Binary = Binary;


/***/ },
/* 16 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON Code type.
	 *
	 * @class
	 * @param {(string|function)} code a string or function.
	 * @param {Object} [scope] an optional scope for the function.
	 * @return {Code}
	 */
	var Code = function Code(code, scope) {
	  if(!(this instanceof Code)) return new Code(code, scope);
	  this._bsontype = 'Code';
	  this.code = code;
	  this.scope = scope == null ? {} : scope;
	};

	/**
	 * @ignore
	 */
	Code.prototype.toJSON = function() {
	  return {scope:this.scope, code:this.code};
	}

	module.exports = Code;
	module.exports.Code = Code;


/***/ },
/* 17 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON DBRef type.
	 *
	 * @class
	 * @param {string} namespace the collection name.
	 * @param {ObjectID} oid the reference ObjectID.
	 * @param {string} [db] optional db name, if omitted the reference is local to the current db.
	 * @return {DBRef}
	 */
	function DBRef(namespace, oid, db) {
	  if(!(this instanceof DBRef)) return new DBRef(namespace, oid, db);
	  
	  this._bsontype = 'DBRef';
	  this.namespace = namespace;
	  this.oid = oid;
	  this.db = db;
	};

	/**
	 * @ignore
	 * @api private
	 */
	DBRef.prototype.toJSON = function() {
	  return {
	    '$ref':this.namespace,
	    '$id':this.oid,
	    '$db':this.db == null ? '' : this.db
	  };
	}

	module.exports = DBRef;
	module.exports.DBRef = DBRef;

/***/ },
/* 18 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON Double type.
	 *
	 * @class
	 * @param {number} value the number we want to represent as a double.
	 * @return {Double}
	 */
	function Double(value) {
	  if(!(this instanceof Double)) return new Double(value);
	  
	  this._bsontype = 'Double';
	  this.value = value;
	}

	/**
	 * Access the number value.
	 *
	 * @method
	 * @return {number} returns the wrapped double number.
	 */
	Double.prototype.valueOf = function() {
	  return this.value;
	};

	/**
	 * @ignore
	 */
	Double.prototype.toJSON = function() {
	  return this.value;
	}

	module.exports = Double;
	module.exports.Double = Double;

/***/ },
/* 19 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON MaxKey type.
	 *
	 * @class
	 * @return {MaxKey} A MaxKey instance
	 */
	function MaxKey() {
	  if(!(this instanceof MaxKey)) return new MaxKey();
	  
	  this._bsontype = 'MaxKey';  
	}

	module.exports = MaxKey;
	module.exports.MaxKey = MaxKey;

/***/ },
/* 20 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON MinKey type.
	 *
	 * @class
	 * @return {MinKey} A MinKey instance
	 */
	function MinKey() {
	  if(!(this instanceof MinKey)) return new MinKey();
	  
	  this._bsontype = 'MinKey';
	}

	module.exports = MinKey;
	module.exports.MinKey = MinKey;

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Module dependencies.
	 * @ignore
	 */
	var BinaryParser = __webpack_require__(22).BinaryParser;

	/**
	 * Machine id.
	 *
	 * Create a random 3-byte value (i.e. unique for this
	 * process). Other drivers use a md5 of the machine id here, but
	 * that would mean an asyc call to gethostname, so we don't bother.
	 * @ignore
	 */
	var MACHINE_ID = parseInt(Math.random() * 0xFFFFFF, 10);

	// Regular expression that checks for hex value
	var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");

	/**
	* Create a new ObjectID instance
	*
	* @class
	* @param {(string|number)} id Can be a 24 byte hex string, 12 byte binary string or a Number.
	* @property {number} generationTime The generation time of this ObjectId instance
	* @return {ObjectID} instance of ObjectID.
	*/
	var ObjectID = function ObjectID(id) {
	  if(!(this instanceof ObjectID)) return new ObjectID(id);
	  if((id instanceof ObjectID)) return id;

	  this._bsontype = 'ObjectID';
	  var __id = null;
	  var valid = ObjectID.isValid(id);

	  // Throw an error if it's not a valid setup
	  if(!valid && id != null){
	    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
	  } else if(valid && typeof id == 'string' && id.length == 24) {
	    return ObjectID.createFromHexString(id);
	  } else if(id == null || typeof id == 'number') {
	    // convert to 12 byte binary string
	    this.id = this.generate(id);
	  } else if(id != null && id.length === 12) {
	    // assume 12 byte string
	    this.id = id;
	  }

	  if(ObjectID.cacheHexString) this.__id = this.toHexString();
	};

	// Allow usage of ObjectId as well as ObjectID
	var ObjectId = ObjectID;

	// Precomputed hex table enables speedy hex string conversion
	var hexTable = [];
	for (var i = 0; i < 256; i++) {
	  hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
	}

	/**
	* Return the ObjectID id as a 24 byte hex string representation
	*
	* @method
	* @return {string} return the 24 byte hex string representation.
	*/
	ObjectID.prototype.toHexString = function() {
	  if(ObjectID.cacheHexString && this.__id) return this.__id;

	  var hexString = '';

	  for (var i = 0; i < this.id.length; i++) {
	    hexString += hexTable[this.id.charCodeAt(i)];
	  }

	  if(ObjectID.cacheHexString) this.__id = hexString;
	  return hexString;
	};

	/**
	* Update the ObjectID index used in generating new ObjectID's on the driver
	*
	* @method
	* @return {number} returns next index value.
	* @ignore
	*/
	ObjectID.prototype.get_inc = function() {
	  return ObjectID.index = (ObjectID.index + 1) % 0xFFFFFF;
	};

	/**
	* Update the ObjectID index used in generating new ObjectID's on the driver
	*
	* @method
	* @return {number} returns next index value.
	* @ignore
	*/
	ObjectID.prototype.getInc = function() {
	  return this.get_inc();
	};

	/**
	* Generate a 12 byte id string used in ObjectID's
	*
	* @method
	* @param {number} [time] optional parameter allowing to pass in a second based timestamp.
	* @return {string} return the 12 byte id binary string.
	*/
	ObjectID.prototype.generate = function(time) {
	  if ('number' != typeof time) {
	    time = parseInt(Date.now()/1000,10);
	  }

	  var time4Bytes = BinaryParser.encodeInt(time, 32, true, true);
	  /* for time-based ObjectID the bytes following the time will be zeroed */
	  var machine3Bytes = BinaryParser.encodeInt(MACHINE_ID, 24, false);
	  var pid2Bytes = BinaryParser.fromShort((typeof process === 'undefined' ? Math.floor(Math.random() * 100000) : process.pid) % 0xFFFF);
	  var index3Bytes = BinaryParser.encodeInt(this.get_inc(), 24, false, true);

	  return time4Bytes + machine3Bytes + pid2Bytes + index3Bytes;
	};

	/**
	* Converts the id into a 24 byte hex string for printing
	*
	* @return {String} return the 24 byte hex string representation.
	* @ignore
	*/
	ObjectID.prototype.toString = function() {
	  return this.toHexString();
	};

	/**
	* Converts to a string representation of this Id.
	*
	* @return {String} return the 24 byte hex string representation.
	* @ignore
	*/
	ObjectID.prototype.inspect = ObjectID.prototype.toString;

	/**
	* Converts to its JSON representation.
	*
	* @return {String} return the 24 byte hex string representation.
	* @ignore
	*/
	ObjectID.prototype.toJSON = function() {
	  return this.toHexString();
	};

	/**
	* Compares the equality of this ObjectID with `otherID`.
	*
	* @method
	* @param {object} otherID ObjectID instance to compare against.
	* @return {boolean} the result of comparing two ObjectID's
	*/
	ObjectID.prototype.equals = function equals (otherID) {
	  var id;

	  if(otherID != null && (otherID instanceof ObjectID || otherID.toHexString)) {
	    id = otherID.id;
	  } else if(typeof otherID == 'string' && ObjectID.isValid(otherID)) {
	    id = ObjectID.createFromHexString(otherID).id;
	  } else {
	    return false;
	  }

	  return this.id === id;
	}

	/**
	* Returns the generation date (accurate up to the second) that this ID was generated.
	*
	* @method
	* @return {date} the generation date
	*/
	ObjectID.prototype.getTimestamp = function() {
	  var timestamp = new Date();
	  timestamp.setTime(Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true)) * 1000);
	  return timestamp;
	}

	/**
	* @ignore
	*/
	ObjectID.index = parseInt(Math.random() * 0xFFFFFF, 10);

	/**
	* @ignore
	*/
	ObjectID.createPk = function createPk () {
	  return new ObjectID();
	};

	/**
	* Creates an ObjectID from a second based number, with the rest of the ObjectID zeroed out. Used for comparisons or sorting the ObjectID.
	*
	* @method
	* @param {number} time an integer number representing a number of seconds.
	* @return {ObjectID} return the created ObjectID
	*/
	ObjectID.createFromTime = function createFromTime (time) {
	  var id = BinaryParser.encodeInt(time, 32, true, true) +
	           BinaryParser.encodeInt(0, 64, true, true);
	  return new ObjectID(id);
	};

	/**
	* Creates an ObjectID from a hex string representation of an ObjectID.
	*
	* @method
	* @param {string} hexString create a ObjectID from a passed in 24 byte hexstring.
	* @return {ObjectID} return the created ObjectID
	*/
	ObjectID.createFromHexString = function createFromHexString (hexString) {
	  // Throw an error if it's not a valid setup
	  if(typeof hexString === 'undefined' || hexString != null && hexString.length != 24)
	    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");

	  var len = hexString.length;

	  if(len > 12*2) {
	    throw new Error('Id cannot be longer than 12 bytes');
	  }

	  var result = ''
	    , string
	    , number;

	  for (var index = 0; index < len; index += 2) {
	    string = hexString.substr(index, 2);
	    number = parseInt(string, 16);
	    result += BinaryParser.fromByte(number);
	  }

	  return new ObjectID(result, hexString);
	};

	/**
	* Checks if a value is a valid bson ObjectId
	*
	* @method
	* @return {boolean} return true if the value is a valid bson ObjectId, return false otherwise.
	*/
	ObjectID.isValid = function isValid(id) {
	  if(id == null) return false;

	  if(typeof id == 'number')
	    return true;
	  if(typeof id == 'string') {
	    return id.length == 12 || (id.length == 24 && checkForHexRegExp.test(id));
	  }
	  return false;
	};

	/**
	* @ignore
	*/
	Object.defineProperty(ObjectID.prototype, "generationTime", {
	   enumerable: true
	 , get: function () {
	     return Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true));
	   }
	 , set: function (value) {
	     var value = BinaryParser.encodeInt(value, 32, true, true);
	     this.id = value + this.id.substr(4);
	     // delete this.__id;
	     this.toHexString();
	   }
	});

	/**
	 * Expose.
	 */
	module.exports = ObjectID;
	module.exports.ObjectID = ObjectID;
	module.exports.ObjectId = ObjectID;

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(12)))

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Binary Parser.
	 * Jonas Raoni Soares Silva
	 * http://jsfromhell.com/classes/binary-parser [v1.0]
	 */
	var chr = String.fromCharCode;

	var maxBits = [];
	for (var i = 0; i < 64; i++) {
		maxBits[i] = Math.pow(2, i);
	}

	function BinaryParser (bigEndian, allowExceptions) {
	  if(!(this instanceof BinaryParser)) return new BinaryParser(bigEndian, allowExceptions);

		this.bigEndian = bigEndian;
		this.allowExceptions = allowExceptions;
	};

	BinaryParser.warn = function warn (msg) {
		if (this.allowExceptions) {
			throw new Error(msg);
	  }

		return 1;
	};

	BinaryParser.decodeFloat = function decodeFloat (data, precisionBits, exponentBits) {
		var b = new this.Buffer(this.bigEndian, data);

		b.checkBuffer(precisionBits + exponentBits + 1);

		var bias = maxBits[exponentBits - 1] - 1
	    , signal = b.readBits(precisionBits + exponentBits, 1)
	    , exponent = b.readBits(precisionBits, exponentBits)
	    , significand = 0
	    , divisor = 2
	    , curByte = b.buffer.length + (-precisionBits >> 3) - 1;

		do {
			for (var byteValue = b.buffer[ ++curByte ], startBit = precisionBits % 8 || 8, mask = 1 << startBit; mask >>= 1; ( byteValue & mask ) && ( significand += 1 / divisor ), divisor *= 2 );
		} while (precisionBits -= startBit);

		return exponent == ( bias << 1 ) + 1 ? significand ? NaN : signal ? -Infinity : +Infinity : ( 1 + signal * -2 ) * ( exponent || significand ? !exponent ? Math.pow( 2, -bias + 1 ) * significand : Math.pow( 2, exponent - bias ) * ( 1 + significand ) : 0 );
	};

	BinaryParser.decodeInt = function decodeInt (data, bits, signed, forceBigEndian) {
	  var b = new this.Buffer(this.bigEndian || forceBigEndian, data)
	      , x = b.readBits(0, bits)
	      , max = maxBits[bits]; //max = Math.pow( 2, bits );

	  return signed && x >= max / 2
	      ? x - max
	      : x;
	};

	BinaryParser.encodeFloat = function encodeFloat (data, precisionBits, exponentBits) {
		var bias = maxBits[exponentBits - 1] - 1
	    , minExp = -bias + 1
	    , maxExp = bias
	    , minUnnormExp = minExp - precisionBits
	    , n = parseFloat(data)
	    , status = isNaN(n) || n == -Infinity || n == +Infinity ? n : 0
	    ,	exp = 0
	    , len = 2 * bias + 1 + precisionBits + 3
	    , bin = new Array(len)
	    , signal = (n = status !== 0 ? 0 : n) < 0
	    , intPart = Math.floor(n = Math.abs(n))
	    , floatPart = n - intPart
	    , lastBit
	    , rounded
	    , result
	    , i
	    , j;

		for (i = len; i; bin[--i] = 0);

		for (i = bias + 2; intPart && i; bin[--i] = intPart % 2, intPart = Math.floor(intPart / 2));

		for (i = bias + 1; floatPart > 0 && i; (bin[++i] = ((floatPart *= 2) >= 1) - 0 ) && --floatPart);

		for (i = -1; ++i < len && !bin[i];);

		if (bin[(lastBit = precisionBits - 1 + (i = (exp = bias + 1 - i) >= minExp && exp <= maxExp ? i + 1 : bias + 1 - (exp = minExp - 1))) + 1]) {
			if (!(rounded = bin[lastBit])) {
				for (j = lastBit + 2; !rounded && j < len; rounded = bin[j++]);
			}

			for (j = lastBit + 1; rounded && --j >= 0; (bin[j] = !bin[j] - 0) && (rounded = 0));
		}

		for (i = i - 2 < 0 ? -1 : i - 3; ++i < len && !bin[i];);

		if ((exp = bias + 1 - i) >= minExp && exp <= maxExp) {
			++i;
	  } else if (exp < minExp) {
			exp != bias + 1 - len && exp < minUnnormExp && this.warn("encodeFloat::float underflow");
			i = bias + 1 - (exp = minExp - 1);
		}

		if (intPart || status !== 0) {
			this.warn(intPart ? "encodeFloat::float overflow" : "encodeFloat::" + status);
			exp = maxExp + 1;
			i = bias + 2;

			if (status == -Infinity) {
				signal = 1;
	    } else if (isNaN(status)) {
				bin[i] = 1;
	    }
		}

		for (n = Math.abs(exp + bias), j = exponentBits + 1, result = ""; --j; result = (n % 2) + result, n = n >>= 1);

		for (n = 0, j = 0, i = (result = (signal ? "1" : "0") + result + bin.slice(i, i + precisionBits).join("")).length, r = []; i; j = (j + 1) % 8) {
			n += (1 << j) * result.charAt(--i);
			if (j == 7) {
				r[r.length] = String.fromCharCode(n);
				n = 0;
			}
		}

		r[r.length] = n
	    ? String.fromCharCode(n)
	    : "";

		return (this.bigEndian ? r.reverse() : r).join("");
	};

	BinaryParser.encodeInt = function encodeInt (data, bits, signed, forceBigEndian) {
		var max = maxBits[bits];

	  if (data >= max || data < -(max / 2)) {
	    this.warn("encodeInt::overflow");
	    data = 0;
	  }

		if (data < 0) {
	    data += max;
	  }

		for (var r = []; data; r[r.length] = String.fromCharCode(data % 256), data = Math.floor(data / 256));

		for (bits = -(-bits >> 3) - r.length; bits--; r[r.length] = "\0");

	  return ((this.bigEndian || forceBigEndian) ? r.reverse() : r).join("");
	};

	BinaryParser.toSmall    = function( data ){ return this.decodeInt( data,  8, true  ); };
	BinaryParser.fromSmall  = function( data ){ return this.encodeInt( data,  8, true  ); };
	BinaryParser.toByte     = function( data ){ return this.decodeInt( data,  8, false ); };
	BinaryParser.fromByte   = function( data ){ return this.encodeInt( data,  8, false ); };
	BinaryParser.toShort    = function( data ){ return this.decodeInt( data, 16, true  ); };
	BinaryParser.fromShort  = function( data ){ return this.encodeInt( data, 16, true  ); };
	BinaryParser.toWord     = function( data ){ return this.decodeInt( data, 16, false ); };
	BinaryParser.fromWord   = function( data ){ return this.encodeInt( data, 16, false ); };
	BinaryParser.toInt      = function( data ){ return this.decodeInt( data, 32, true  ); };
	BinaryParser.fromInt    = function( data ){ return this.encodeInt( data, 32, true  ); };
	BinaryParser.toLong     = function( data ){ return this.decodeInt( data, 64, true  ); };
	BinaryParser.fromLong   = function( data ){ return this.encodeInt( data, 64, true  ); };
	BinaryParser.toDWord    = function( data ){ return this.decodeInt( data, 32, false ); };
	BinaryParser.fromDWord  = function( data ){ return this.encodeInt( data, 32, false ); };
	BinaryParser.toQWord    = function( data ){ return this.decodeInt( data, 64, true ); };
	BinaryParser.fromQWord  = function( data ){ return this.encodeInt( data, 64, true ); };
	BinaryParser.toFloat    = function( data ){ return this.decodeFloat( data, 23, 8   ); };
	BinaryParser.fromFloat  = function( data ){ return this.encodeFloat( data, 23, 8   ); };
	BinaryParser.toDouble   = function( data ){ return this.decodeFloat( data, 52, 11  ); };
	BinaryParser.fromDouble = function( data ){ return this.encodeFloat( data, 52, 11  ); };

	// Factor out the encode so it can be shared by add_header and push_int32
	BinaryParser.encode_int32 = function encode_int32 (number, asArray) {
	  var a, b, c, d, unsigned;
	  unsigned = (number < 0) ? (number + 0x100000000) : number;
	  a = Math.floor(unsigned / 0xffffff);
	  unsigned &= 0xffffff;
	  b = Math.floor(unsigned / 0xffff);
	  unsigned &= 0xffff;
	  c = Math.floor(unsigned / 0xff);
	  unsigned &= 0xff;
	  d = Math.floor(unsigned);
	  return asArray ? [chr(a), chr(b), chr(c), chr(d)] : chr(a) + chr(b) + chr(c) + chr(d);
	};

	BinaryParser.encode_int64 = function encode_int64 (number) {
	  var a, b, c, d, e, f, g, h, unsigned;
	  unsigned = (number < 0) ? (number + 0x10000000000000000) : number;
	  a = Math.floor(unsigned / 0xffffffffffffff);
	  unsigned &= 0xffffffffffffff;
	  b = Math.floor(unsigned / 0xffffffffffff);
	  unsigned &= 0xffffffffffff;
	  c = Math.floor(unsigned / 0xffffffffff);
	  unsigned &= 0xffffffffff;
	  d = Math.floor(unsigned / 0xffffffff);
	  unsigned &= 0xffffffff;
	  e = Math.floor(unsigned / 0xffffff);
	  unsigned &= 0xffffff;
	  f = Math.floor(unsigned / 0xffff);
	  unsigned &= 0xffff;
	  g = Math.floor(unsigned / 0xff);
	  unsigned &= 0xff;
	  h = Math.floor(unsigned);
	  return chr(a) + chr(b) + chr(c) + chr(d) + chr(e) + chr(f) + chr(g) + chr(h);
	};

	/**
	 * UTF8 methods
	 */

	// Take a raw binary string and return a utf8 string
	BinaryParser.decode_utf8 = function decode_utf8 (binaryStr) {
	  var len = binaryStr.length
	    , decoded = ''
	    , i = 0
	    , c = 0
	    , c1 = 0
	    , c2 = 0
	    , c3;

	  while (i < len) {
	    c = binaryStr.charCodeAt(i);
	    if (c < 128) {
	      decoded += String.fromCharCode(c);
	      i++;
	    } else if ((c > 191) && (c < 224)) {
		    c2 = binaryStr.charCodeAt(i+1);
	      decoded += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
	      i += 2;
	    } else {
		    c2 = binaryStr.charCodeAt(i+1);
		    c3 = binaryStr.charCodeAt(i+2);
	      decoded += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
	      i += 3;
	    }
	  }

	  return decoded;
	};

	// Encode a cstring
	BinaryParser.encode_cstring = function encode_cstring (s) {
	  return unescape(encodeURIComponent(s)) + BinaryParser.fromByte(0);
	};

	// Take a utf8 string and return a binary string
	BinaryParser.encode_utf8 = function encode_utf8 (s) {
	  var a = ""
	    , c;

	  for (var n = 0, len = s.length; n < len; n++) {
	    c = s.charCodeAt(n);

	    if (c < 128) {
		    a += String.fromCharCode(c);
	    } else if ((c > 127) && (c < 2048)) {
		    a += String.fromCharCode((c>>6) | 192) ;
		    a += String.fromCharCode((c&63) | 128);
	    } else {
	      a += String.fromCharCode((c>>12) | 224);
	      a += String.fromCharCode(((c>>6) & 63) | 128);
	      a += String.fromCharCode((c&63) | 128);
	    }
	  }

	  return a;
	};

	BinaryParser.hprint = function hprint (s) {
	  var number;

	  for (var i = 0, len = s.length; i < len; i++) {
	    if (s.charCodeAt(i) < 32) {
	      number = s.charCodeAt(i) <= 15
	        ? "0" + s.charCodeAt(i).toString(16)
	        : s.charCodeAt(i).toString(16);
	      process.stdout.write(number + " ")
	    } else {
	      number = s.charCodeAt(i) <= 15
	        ? "0" + s.charCodeAt(i).toString(16)
	        : s.charCodeAt(i).toString(16);
	        process.stdout.write(number + " ")
	    }
	  }

	  process.stdout.write("\n\n");
	};

	BinaryParser.ilprint = function hprint (s) {
	  var number;

	  for (var i = 0, len = s.length; i < len; i++) {
	    if (s.charCodeAt(i) < 32) {
	      number = s.charCodeAt(i) <= 15
	        ? "0" + s.charCodeAt(i).toString(10)
	        : s.charCodeAt(i).toString(10);

	      __webpack_require__(23).debug(number+' : ');
	    } else {
	      number = s.charCodeAt(i) <= 15
	        ? "0" + s.charCodeAt(i).toString(10)
	        : s.charCodeAt(i).toString(10);
	      __webpack_require__(23).debug(number+' : '+ s.charAt(i));
	    }
	  }
	};

	BinaryParser.hlprint = function hprint (s) {
	  var number;

	  for (var i = 0, len = s.length; i < len; i++) {
	    if (s.charCodeAt(i) < 32) {
	      number = s.charCodeAt(i) <= 15
	        ? "0" + s.charCodeAt(i).toString(16)
	        : s.charCodeAt(i).toString(16);
	      __webpack_require__(23).debug(number+' : ');
	    } else {
	      number = s.charCodeAt(i) <= 15
	        ? "0" + s.charCodeAt(i).toString(16)
	        : s.charCodeAt(i).toString(16);
	      __webpack_require__(23).debug(number+' : '+ s.charAt(i));
	    }
	  }
	};

	/**
	 * BinaryParser buffer constructor.
	 */
	function BinaryParserBuffer (bigEndian, buffer) {
	  this.bigEndian = bigEndian || 0;
	  this.buffer = [];
	  this.setBuffer(buffer);
	};

	BinaryParserBuffer.prototype.setBuffer = function setBuffer (data) {
	  var l, i, b;

		if (data) {
	    i = l = data.length;
	    b = this.buffer = new Array(l);
			for (; i; b[l - i] = data.charCodeAt(--i));
			this.bigEndian && b.reverse();
		}
	};

	BinaryParserBuffer.prototype.hasNeededBits = function hasNeededBits (neededBits) {
		return this.buffer.length >= -(-neededBits >> 3);
	};

	BinaryParserBuffer.prototype.checkBuffer = function checkBuffer (neededBits) {
		if (!this.hasNeededBits(neededBits)) {
			throw new Error("checkBuffer::missing bytes");
	  }
	};

	BinaryParserBuffer.prototype.readBits = function readBits (start, length) {
		//shl fix: Henri Torgemane ~1996 (compressed by Jonas Raoni)

		function shl (a, b) {
			for (; b--; a = ((a %= 0x7fffffff + 1) & 0x40000000) == 0x40000000 ? a * 2 : (a - 0x40000000) * 2 + 0x7fffffff + 1);
			return a;
		}

		if (start < 0 || length <= 0) {
			return 0;
	  }

		this.checkBuffer(start + length);

	  var offsetLeft
	    , offsetRight = start % 8
	    , curByte = this.buffer.length - ( start >> 3 ) - 1
	    , lastByte = this.buffer.length + ( -( start + length ) >> 3 )
	    , diff = curByte - lastByte
	    , sum = ((this.buffer[ curByte ] >> offsetRight) & ((1 << (diff ? 8 - offsetRight : length)) - 1)) + (diff && (offsetLeft = (start + length) % 8) ? (this.buffer[lastByte++] & ((1 << offsetLeft) - 1)) << (diff-- << 3) - offsetRight : 0);

		for(; diff; sum += shl(this.buffer[lastByte++], (diff-- << 3) - offsetRight));

		return sum;
	};

	/**
	 * Expose.
	 */
	BinaryParser.Buffer = BinaryParserBuffer;

	exports.BinaryParser = BinaryParser;

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(12)))

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, process) {// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	var formatRegExp = /%[sdj%]/g;
	exports.format = function(f) {
	  if (!isString(f)) {
	    var objects = [];
	    for (var i = 0; i < arguments.length; i++) {
	      objects.push(inspect(arguments[i]));
	    }
	    return objects.join(' ');
	  }

	  var i = 1;
	  var args = arguments;
	  var len = args.length;
	  var str = String(f).replace(formatRegExp, function(x) {
	    if (x === '%%') return '%';
	    if (i >= len) return x;
	    switch (x) {
	      case '%s': return String(args[i++]);
	      case '%d': return Number(args[i++]);
	      case '%j':
	        try {
	          return JSON.stringify(args[i++]);
	        } catch (_) {
	          return '[Circular]';
	        }
	      default:
	        return x;
	    }
	  });
	  for (var x = args[i]; i < len; x = args[++i]) {
	    if (isNull(x) || !isObject(x)) {
	      str += ' ' + x;
	    } else {
	      str += ' ' + inspect(x);
	    }
	  }
	  return str;
	};


	// Mark that a method should not be used.
	// Returns a modified function which warns once by default.
	// If --no-deprecation is set, then it is a no-op.
	exports.deprecate = function(fn, msg) {
	  // Allow for deprecating things in the process of starting up.
	  if (isUndefined(global.process)) {
	    return function() {
	      return exports.deprecate(fn, msg).apply(this, arguments);
	    };
	  }

	  if (process.noDeprecation === true) {
	    return fn;
	  }

	  var warned = false;
	  function deprecated() {
	    if (!warned) {
	      if (process.throwDeprecation) {
	        throw new Error(msg);
	      } else if (process.traceDeprecation) {
	        console.trace(msg);
	      } else {
	        console.error(msg);
	      }
	      warned = true;
	    }
	    return fn.apply(this, arguments);
	  }

	  return deprecated;
	};


	var debugs = {};
	var debugEnviron;
	exports.debuglog = function(set) {
	  if (isUndefined(debugEnviron))
	    debugEnviron = process.env.NODE_DEBUG || '';
	  set = set.toUpperCase();
	  if (!debugs[set]) {
	    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
	      var pid = process.pid;
	      debugs[set] = function() {
	        var msg = exports.format.apply(exports, arguments);
	        console.error('%s %d: %s', set, pid, msg);
	      };
	    } else {
	      debugs[set] = function() {};
	    }
	  }
	  return debugs[set];
	};


	/**
	 * Echos the value of a value. Trys to print the value out
	 * in the best way possible given the different types.
	 *
	 * @param {Object} obj The object to print out.
	 * @param {Object} opts Optional options object that alters the output.
	 */
	/* legacy: obj, showHidden, depth, colors*/
	function inspect(obj, opts) {
	  // default options
	  var ctx = {
	    seen: [],
	    stylize: stylizeNoColor
	  };
	  // legacy...
	  if (arguments.length >= 3) ctx.depth = arguments[2];
	  if (arguments.length >= 4) ctx.colors = arguments[3];
	  if (isBoolean(opts)) {
	    // legacy...
	    ctx.showHidden = opts;
	  } else if (opts) {
	    // got an "options" object
	    exports._extend(ctx, opts);
	  }
	  // set default options
	  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
	  if (isUndefined(ctx.depth)) ctx.depth = 2;
	  if (isUndefined(ctx.colors)) ctx.colors = false;
	  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
	  if (ctx.colors) ctx.stylize = stylizeWithColor;
	  return formatValue(ctx, obj, ctx.depth);
	}
	exports.inspect = inspect;


	// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
	inspect.colors = {
	  'bold' : [1, 22],
	  'italic' : [3, 23],
	  'underline' : [4, 24],
	  'inverse' : [7, 27],
	  'white' : [37, 39],
	  'grey' : [90, 39],
	  'black' : [30, 39],
	  'blue' : [34, 39],
	  'cyan' : [36, 39],
	  'green' : [32, 39],
	  'magenta' : [35, 39],
	  'red' : [31, 39],
	  'yellow' : [33, 39]
	};

	// Don't use 'blue' not visible on cmd.exe
	inspect.styles = {
	  'special': 'cyan',
	  'number': 'yellow',
	  'boolean': 'yellow',
	  'undefined': 'grey',
	  'null': 'bold',
	  'string': 'green',
	  'date': 'magenta',
	  // "name": intentionally not styling
	  'regexp': 'red'
	};


	function stylizeWithColor(str, styleType) {
	  var style = inspect.styles[styleType];

	  if (style) {
	    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
	           '\u001b[' + inspect.colors[style][1] + 'm';
	  } else {
	    return str;
	  }
	}


	function stylizeNoColor(str, styleType) {
	  return str;
	}


	function arrayToHash(array) {
	  var hash = {};

	  array.forEach(function(val, idx) {
	    hash[val] = true;
	  });

	  return hash;
	}


	function formatValue(ctx, value, recurseTimes) {
	  // Provide a hook for user-specified inspect functions.
	  // Check that value is an object with an inspect function on it
	  if (ctx.customInspect &&
	      value &&
	      isFunction(value.inspect) &&
	      // Filter out the util module, it's inspect function is special
	      value.inspect !== exports.inspect &&
	      // Also filter out any prototype objects using the circular check.
	      !(value.constructor && value.constructor.prototype === value)) {
	    var ret = value.inspect(recurseTimes, ctx);
	    if (!isString(ret)) {
	      ret = formatValue(ctx, ret, recurseTimes);
	    }
	    return ret;
	  }

	  // Primitive types cannot have properties
	  var primitive = formatPrimitive(ctx, value);
	  if (primitive) {
	    return primitive;
	  }

	  // Look up the keys of the object.
	  var keys = Object.keys(value);
	  var visibleKeys = arrayToHash(keys);

	  if (ctx.showHidden) {
	    keys = Object.getOwnPropertyNames(value);
	  }

	  // IE doesn't make error fields non-enumerable
	  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
	  if (isError(value)
	      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
	    return formatError(value);
	  }

	  // Some type of object without properties can be shortcutted.
	  if (keys.length === 0) {
	    if (isFunction(value)) {
	      var name = value.name ? ': ' + value.name : '';
	      return ctx.stylize('[Function' + name + ']', 'special');
	    }
	    if (isRegExp(value)) {
	      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
	    }
	    if (isDate(value)) {
	      return ctx.stylize(Date.prototype.toString.call(value), 'date');
	    }
	    if (isError(value)) {
	      return formatError(value);
	    }
	  }

	  var base = '', array = false, braces = ['{', '}'];

	  // Make Array say that they are Array
	  if (isArray(value)) {
	    array = true;
	    braces = ['[', ']'];
	  }

	  // Make functions say that they are functions
	  if (isFunction(value)) {
	    var n = value.name ? ': ' + value.name : '';
	    base = ' [Function' + n + ']';
	  }

	  // Make RegExps say that they are RegExps
	  if (isRegExp(value)) {
	    base = ' ' + RegExp.prototype.toString.call(value);
	  }

	  // Make dates with properties first say the date
	  if (isDate(value)) {
	    base = ' ' + Date.prototype.toUTCString.call(value);
	  }

	  // Make error with message first say the error
	  if (isError(value)) {
	    base = ' ' + formatError(value);
	  }

	  if (keys.length === 0 && (!array || value.length == 0)) {
	    return braces[0] + base + braces[1];
	  }

	  if (recurseTimes < 0) {
	    if (isRegExp(value)) {
	      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
	    } else {
	      return ctx.stylize('[Object]', 'special');
	    }
	  }

	  ctx.seen.push(value);

	  var output;
	  if (array) {
	    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
	  } else {
	    output = keys.map(function(key) {
	      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
	    });
	  }

	  ctx.seen.pop();

	  return reduceToSingleString(output, base, braces);
	}


	function formatPrimitive(ctx, value) {
	  if (isUndefined(value))
	    return ctx.stylize('undefined', 'undefined');
	  if (isString(value)) {
	    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
	                                             .replace(/'/g, "\\'")
	                                             .replace(/\\"/g, '"') + '\'';
	    return ctx.stylize(simple, 'string');
	  }
	  if (isNumber(value))
	    return ctx.stylize('' + value, 'number');
	  if (isBoolean(value))
	    return ctx.stylize('' + value, 'boolean');
	  // For some reason typeof null is "object", so special case here.
	  if (isNull(value))
	    return ctx.stylize('null', 'null');
	}


	function formatError(value) {
	  return '[' + Error.prototype.toString.call(value) + ']';
	}


	function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
	  var output = [];
	  for (var i = 0, l = value.length; i < l; ++i) {
	    if (hasOwnProperty(value, String(i))) {
	      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
	          String(i), true));
	    } else {
	      output.push('');
	    }
	  }
	  keys.forEach(function(key) {
	    if (!key.match(/^\d+$/)) {
	      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
	          key, true));
	    }
	  });
	  return output;
	}


	function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
	  var name, str, desc;
	  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
	  if (desc.get) {
	    if (desc.set) {
	      str = ctx.stylize('[Getter/Setter]', 'special');
	    } else {
	      str = ctx.stylize('[Getter]', 'special');
	    }
	  } else {
	    if (desc.set) {
	      str = ctx.stylize('[Setter]', 'special');
	    }
	  }
	  if (!hasOwnProperty(visibleKeys, key)) {
	    name = '[' + key + ']';
	  }
	  if (!str) {
	    if (ctx.seen.indexOf(desc.value) < 0) {
	      if (isNull(recurseTimes)) {
	        str = formatValue(ctx, desc.value, null);
	      } else {
	        str = formatValue(ctx, desc.value, recurseTimes - 1);
	      }
	      if (str.indexOf('\n') > -1) {
	        if (array) {
	          str = str.split('\n').map(function(line) {
	            return '  ' + line;
	          }).join('\n').substr(2);
	        } else {
	          str = '\n' + str.split('\n').map(function(line) {
	            return '   ' + line;
	          }).join('\n');
	        }
	      }
	    } else {
	      str = ctx.stylize('[Circular]', 'special');
	    }
	  }
	  if (isUndefined(name)) {
	    if (array && key.match(/^\d+$/)) {
	      return str;
	    }
	    name = JSON.stringify('' + key);
	    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
	      name = name.substr(1, name.length - 2);
	      name = ctx.stylize(name, 'name');
	    } else {
	      name = name.replace(/'/g, "\\'")
	                 .replace(/\\"/g, '"')
	                 .replace(/(^"|"$)/g, "'");
	      name = ctx.stylize(name, 'string');
	    }
	  }

	  return name + ': ' + str;
	}


	function reduceToSingleString(output, base, braces) {
	  var numLinesEst = 0;
	  var length = output.reduce(function(prev, cur) {
	    numLinesEst++;
	    if (cur.indexOf('\n') >= 0) numLinesEst++;
	    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
	  }, 0);

	  if (length > 60) {
	    return braces[0] +
	           (base === '' ? '' : base + '\n ') +
	           ' ' +
	           output.join(',\n  ') +
	           ' ' +
	           braces[1];
	  }

	  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
	}


	// NOTE: These type checking functions intentionally don't use `instanceof`
	// because it is fragile and can be easily faked with `Object.create()`.
	function isArray(ar) {
	  return Array.isArray(ar);
	}
	exports.isArray = isArray;

	function isBoolean(arg) {
	  return typeof arg === 'boolean';
	}
	exports.isBoolean = isBoolean;

	function isNull(arg) {
	  return arg === null;
	}
	exports.isNull = isNull;

	function isNullOrUndefined(arg) {
	  return arg == null;
	}
	exports.isNullOrUndefined = isNullOrUndefined;

	function isNumber(arg) {
	  return typeof arg === 'number';
	}
	exports.isNumber = isNumber;

	function isString(arg) {
	  return typeof arg === 'string';
	}
	exports.isString = isString;

	function isSymbol(arg) {
	  return typeof arg === 'symbol';
	}
	exports.isSymbol = isSymbol;

	function isUndefined(arg) {
	  return arg === void 0;
	}
	exports.isUndefined = isUndefined;

	function isRegExp(re) {
	  return isObject(re) && objectToString(re) === '[object RegExp]';
	}
	exports.isRegExp = isRegExp;

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}
	exports.isObject = isObject;

	function isDate(d) {
	  return isObject(d) && objectToString(d) === '[object Date]';
	}
	exports.isDate = isDate;

	function isError(e) {
	  return isObject(e) &&
	      (objectToString(e) === '[object Error]' || e instanceof Error);
	}
	exports.isError = isError;

	function isFunction(arg) {
	  return typeof arg === 'function';
	}
	exports.isFunction = isFunction;

	function isPrimitive(arg) {
	  return arg === null ||
	         typeof arg === 'boolean' ||
	         typeof arg === 'number' ||
	         typeof arg === 'string' ||
	         typeof arg === 'symbol' ||  // ES6 symbol
	         typeof arg === 'undefined';
	}
	exports.isPrimitive = isPrimitive;

	exports.isBuffer = __webpack_require__(24);

	function objectToString(o) {
	  return Object.prototype.toString.call(o);
	}


	function pad(n) {
	  return n < 10 ? '0' + n.toString(10) : n.toString(10);
	}


	var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
	              'Oct', 'Nov', 'Dec'];

	// 26 Feb 16:19:34
	function timestamp() {
	  var d = new Date();
	  var time = [pad(d.getHours()),
	              pad(d.getMinutes()),
	              pad(d.getSeconds())].join(':');
	  return [d.getDate(), months[d.getMonth()], time].join(' ');
	}


	// log is just a thin wrapper to console.log that prepends a timestamp
	exports.log = function() {
	  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
	};


	/**
	 * Inherit the prototype methods from one constructor into another.
	 *
	 * The Function.prototype.inherits from lang.js rewritten as a standalone
	 * function (not on Function.prototype). NOTE: If this file is to be loaded
	 * during bootstrapping this function needs to be rewritten using some native
	 * functions as prototype setup using normal JavaScript does not work as
	 * expected during bootstrapping (see mirror.js in r114903).
	 *
	 * @param {function} ctor Constructor function which needs to inherit the
	 *     prototype.
	 * @param {function} superCtor Constructor function to inherit prototype from.
	 */
	exports.inherits = __webpack_require__(25);

	exports._extend = function(origin, add) {
	  // Don't do anything if add isn't an object
	  if (!add || !isObject(add)) return origin;

	  var keys = Object.keys(add);
	  var i = keys.length;
	  while (i--) {
	    origin[keys[i]] = add[keys[i]];
	  }
	  return origin;
	};

	function hasOwnProperty(obj, prop) {
	  return Object.prototype.hasOwnProperty.call(obj, prop);
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(12)))

/***/ },
/* 24 */
/***/ function(module, exports) {

	module.exports = function isBuffer(arg) {
	  return arg && typeof arg === 'object'
	    && typeof arg.copy === 'function'
	    && typeof arg.fill === 'function'
	    && typeof arg.readUInt8 === 'function';
	}

/***/ },
/* 25 */
/***/ function(module, exports) {

	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    ctor.prototype = Object.create(superCtor.prototype, {
	      constructor: {
	        value: ctor,
	        enumerable: false,
	        writable: true,
	        configurable: true
	      }
	    });
	  };
	} else {
	  // old school shim for old browsers
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    var TempCtor = function () {}
	    TempCtor.prototype = superCtor.prototype
	    ctor.prototype = new TempCtor()
	    ctor.prototype.constructor = ctor
	  }
	}


/***/ },
/* 26 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON RegExp type.
	 *
	 * @class
	 * @return {BSONRegExp} A MinKey instance
	 */
	function BSONRegExp(pattern, options) {
	  if(!(this instanceof BSONRegExp)) return new BSONRegExp();
	  
	  // Execute
	  this._bsontype = 'BSONRegExp';
	  this.pattern = pattern;
	  this.options = options;

	  // Validate options
	  for(var i = 0; i < options.length; i++) {
	    if(!(this.options[i] == 'i' 
	      || this.options[i] == 'm'
	      || this.options[i] == 'x'
	      || this.options[i] == 'l'
	      || this.options[i] == 's'
	      || this.options[i] == 'u'
	    )) {
	      throw new Error('the regular expression options [' + this.options[i] + "] is not supported");
	    }
	  }
	}

	module.exports = BSONRegExp;
	module.exports.BSONRegExp = BSONRegExp;

/***/ },
/* 27 */
/***/ function(module, exports) {

	/**
	 * A class representation of the BSON Symbol type.
	 *
	 * @class
	 * @deprecated
	 * @param {string} value the string representing the symbol.
	 * @return {Symbol}
	 */
	function Symbol(value) {
	  if(!(this instanceof Symbol)) return new Symbol(value);
	  this._bsontype = 'Symbol';
	  this.value = value;
	}

	/**
	 * Access the wrapped string value.
	 *
	 * @method
	 * @return {String} returns the wrapped string.
	 */
	Symbol.prototype.valueOf = function() {
	  return this.value;
	};

	/**
	 * @ignore
	 */
	Symbol.prototype.toString = function() {
	  return this.value;
	}

	/**
	 * @ignore
	 */
	Symbol.prototype.inspect = function() {
	  return this.value;
	}

	/**
	 * @ignore
	 */
	Symbol.prototype.toJSON = function() {
	  return this.value;
	}

	module.exports = Symbol;
	module.exports.Symbol = Symbol;


/***/ },
/* 28 */
/***/ function(module, exports) {

	// Licensed under the Apache License, Version 2.0 (the "License");
	// you may not use this file except in compliance with the License.
	// You may obtain a copy of the License at
	//
	//     http://www.apache.org/licenses/LICENSE-2.0
	//
	// Unless required by applicable law or agreed to in writing, software
	// distributed under the License is distributed on an "AS IS" BASIS,
	// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	// See the License for the specific language governing permissions and
	// limitations under the License.
	//
	// Copyright 2009 Google Inc. All Rights Reserved

	/**
	 * This type is for INTERNAL use in MongoDB only and should not be used in applications.
	 * The appropriate corresponding type is the JavaScript Date type.
	 * 
	 * Defines a Timestamp class for representing a 64-bit two's-complement
	 * integer value, which faithfully simulates the behavior of a Java "Timestamp". This
	 * implementation is derived from TimestampLib in GWT.
	 *
	 * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
	 * values as *signed* integers.  See the from* functions below for more
	 * convenient ways of constructing Timestamps.
	 *
	 * The internal representation of a Timestamp is the two given signed, 32-bit values.
	 * We use 32-bit pieces because these are the size of integers on which
	 * Javascript performs bit-operations.  For operations like addition and
	 * multiplication, we split each number into 16-bit pieces, which can easily be
	 * multiplied within Javascript's floating-point representation without overflow
	 * or change in sign.
	 *
	 * In the algorithms below, we frequently reduce the negative case to the
	 * positive case by negating the input(s) and then post-processing the result.
	 * Note that we must ALWAYS check specially whether those values are MIN_VALUE
	 * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
	 * a positive number, it overflows back into a negative).  Not handling this
	 * case would often result in infinite recursion.
	 *
	 * @class
	 * @param {number} low  the low (signed) 32 bits of the Timestamp.
	 * @param {number} high the high (signed) 32 bits of the Timestamp.
	 */
	function Timestamp(low, high) {
	  if(!(this instanceof Timestamp)) return new Timestamp(low, high);
	  this._bsontype = 'Timestamp';
	  /**
	   * @type {number}
	   * @ignore
	   */
	  this.low_ = low | 0;  // force into 32 signed bits.

	  /**
	   * @type {number}
	   * @ignore
	   */
	  this.high_ = high | 0;  // force into 32 signed bits.
	};

	/**
	 * Return the int value.
	 *
	 * @return {number} the value, assuming it is a 32-bit integer.
	 */
	Timestamp.prototype.toInt = function() {
	  return this.low_;
	};

	/**
	 * Return the Number value.
	 *
	 * @method
	 * @return {number} the closest floating-point representation to this value.
	 */
	Timestamp.prototype.toNumber = function() {
	  return this.high_ * Timestamp.TWO_PWR_32_DBL_ +
	         this.getLowBitsUnsigned();
	};

	/**
	 * Return the JSON value.
	 *
	 * @method
	 * @return {string} the JSON representation.
	 */
	Timestamp.prototype.toJSON = function() {
	  return this.toString();
	}

	/**
	 * Return the String value.
	 *
	 * @method
	 * @param {number} [opt_radix] the radix in which the text should be written.
	 * @return {string} the textual representation of this value.
	 */
	Timestamp.prototype.toString = function(opt_radix) {
	  var radix = opt_radix || 10;
	  if (radix < 2 || 36 < radix) {
	    throw Error('radix out of range: ' + radix);
	  }

	  if (this.isZero()) {
	    return '0';
	  }

	  if (this.isNegative()) {
	    if (this.equals(Timestamp.MIN_VALUE)) {
	      // We need to change the Timestamp value before it can be negated, so we remove
	      // the bottom-most digit in this base and then recurse to do the rest.
	      var radixTimestamp = Timestamp.fromNumber(radix);
	      var div = this.div(radixTimestamp);
	      var rem = div.multiply(radixTimestamp).subtract(this);
	      return div.toString(radix) + rem.toInt().toString(radix);
	    } else {
	      return '-' + this.negate().toString(radix);
	    }
	  }

	  // Do several (6) digits each time through the loop, so as to
	  // minimize the calls to the very expensive emulated div.
	  var radixToPower = Timestamp.fromNumber(Math.pow(radix, 6));

	  var rem = this;
	  var result = '';
	  while (true) {
	    var remDiv = rem.div(radixToPower);
	    var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
	    var digits = intval.toString(radix);

	    rem = remDiv;
	    if (rem.isZero()) {
	      return digits + result;
	    } else {
	      while (digits.length < 6) {
	        digits = '0' + digits;
	      }
	      result = '' + digits + result;
	    }
	  }
	};

	/**
	 * Return the high 32-bits value.
	 *
	 * @method
	 * @return {number} the high 32-bits as a signed value.
	 */
	Timestamp.prototype.getHighBits = function() {
	  return this.high_;
	};

	/**
	 * Return the low 32-bits value.
	 *
	 * @method
	 * @return {number} the low 32-bits as a signed value.
	 */
	Timestamp.prototype.getLowBits = function() {
	  return this.low_;
	};

	/**
	 * Return the low unsigned 32-bits value.
	 *
	 * @method
	 * @return {number} the low 32-bits as an unsigned value.
	 */
	Timestamp.prototype.getLowBitsUnsigned = function() {
	  return (this.low_ >= 0) ?
	      this.low_ : Timestamp.TWO_PWR_32_DBL_ + this.low_;
	};

	/**
	 * Returns the number of bits needed to represent the absolute value of this Timestamp.
	 *
	 * @method
	 * @return {number} Returns the number of bits needed to represent the absolute value of this Timestamp.
	 */
	Timestamp.prototype.getNumBitsAbs = function() {
	  if (this.isNegative()) {
	    if (this.equals(Timestamp.MIN_VALUE)) {
	      return 64;
	    } else {
	      return this.negate().getNumBitsAbs();
	    }
	  } else {
	    var val = this.high_ != 0 ? this.high_ : this.low_;
	    for (var bit = 31; bit > 0; bit--) {
	      if ((val & (1 << bit)) != 0) {
	        break;
	      }
	    }
	    return this.high_ != 0 ? bit + 33 : bit + 1;
	  }
	};

	/**
	 * Return whether this value is zero.
	 *
	 * @method
	 * @return {boolean} whether this value is zero.
	 */
	Timestamp.prototype.isZero = function() {
	  return this.high_ == 0 && this.low_ == 0;
	};

	/**
	 * Return whether this value is negative.
	 *
	 * @method
	 * @return {boolean} whether this value is negative.
	 */
	Timestamp.prototype.isNegative = function() {
	  return this.high_ < 0;
	};

	/**
	 * Return whether this value is odd.
	 *
	 * @method
	 * @return {boolean} whether this value is odd.
	 */
	Timestamp.prototype.isOdd = function() {
	  return (this.low_ & 1) == 1;
	};

	/**
	 * Return whether this Timestamp equals the other
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to compare against.
	 * @return {boolean} whether this Timestamp equals the other
	 */
	Timestamp.prototype.equals = function(other) {
	  return (this.high_ == other.high_) && (this.low_ == other.low_);
	};

	/**
	 * Return whether this Timestamp does not equal the other.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to compare against.
	 * @return {boolean} whether this Timestamp does not equal the other.
	 */
	Timestamp.prototype.notEquals = function(other) {
	  return (this.high_ != other.high_) || (this.low_ != other.low_);
	};

	/**
	 * Return whether this Timestamp is less than the other.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to compare against.
	 * @return {boolean} whether this Timestamp is less than the other.
	 */
	Timestamp.prototype.lessThan = function(other) {
	  return this.compare(other) < 0;
	};

	/**
	 * Return whether this Timestamp is less than or equal to the other.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to compare against.
	 * @return {boolean} whether this Timestamp is less than or equal to the other.
	 */
	Timestamp.prototype.lessThanOrEqual = function(other) {
	  return this.compare(other) <= 0;
	};

	/**
	 * Return whether this Timestamp is greater than the other.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to compare against.
	 * @return {boolean} whether this Timestamp is greater than the other.
	 */
	Timestamp.prototype.greaterThan = function(other) {
	  return this.compare(other) > 0;
	};

	/**
	 * Return whether this Timestamp is greater than or equal to the other.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to compare against.
	 * @return {boolean} whether this Timestamp is greater than or equal to the other.
	 */
	Timestamp.prototype.greaterThanOrEqual = function(other) {
	  return this.compare(other) >= 0;
	};

	/**
	 * Compares this Timestamp with the given one.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to compare against.
	 * @return {boolean} 0 if they are the same, 1 if the this is greater, and -1 if the given one is greater.
	 */
	Timestamp.prototype.compare = function(other) {
	  if (this.equals(other)) {
	    return 0;
	  }

	  var thisNeg = this.isNegative();
	  var otherNeg = other.isNegative();
	  if (thisNeg && !otherNeg) {
	    return -1;
	  }
	  if (!thisNeg && otherNeg) {
	    return 1;
	  }

	  // at this point, the signs are the same, so subtraction will not overflow
	  if (this.subtract(other).isNegative()) {
	    return -1;
	  } else {
	    return 1;
	  }
	};

	/**
	 * The negation of this value.
	 *
	 * @method
	 * @return {Timestamp} the negation of this value.
	 */
	Timestamp.prototype.negate = function() {
	  if (this.equals(Timestamp.MIN_VALUE)) {
	    return Timestamp.MIN_VALUE;
	  } else {
	    return this.not().add(Timestamp.ONE);
	  }
	};

	/**
	 * Returns the sum of this and the given Timestamp.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to add to this one.
	 * @return {Timestamp} the sum of this and the given Timestamp.
	 */
	Timestamp.prototype.add = function(other) {
	  // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

	  var a48 = this.high_ >>> 16;
	  var a32 = this.high_ & 0xFFFF;
	  var a16 = this.low_ >>> 16;
	  var a00 = this.low_ & 0xFFFF;

	  var b48 = other.high_ >>> 16;
	  var b32 = other.high_ & 0xFFFF;
	  var b16 = other.low_ >>> 16;
	  var b00 = other.low_ & 0xFFFF;

	  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
	  c00 += a00 + b00;
	  c16 += c00 >>> 16;
	  c00 &= 0xFFFF;
	  c16 += a16 + b16;
	  c32 += c16 >>> 16;
	  c16 &= 0xFFFF;
	  c32 += a32 + b32;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c48 += a48 + b48;
	  c48 &= 0xFFFF;
	  return Timestamp.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
	};

	/**
	 * Returns the difference of this and the given Timestamp.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to subtract from this.
	 * @return {Timestamp} the difference of this and the given Timestamp.
	 */
	Timestamp.prototype.subtract = function(other) {
	  return this.add(other.negate());
	};

	/**
	 * Returns the product of this and the given Timestamp.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp to multiply with this.
	 * @return {Timestamp} the product of this and the other.
	 */
	Timestamp.prototype.multiply = function(other) {
	  if (this.isZero()) {
	    return Timestamp.ZERO;
	  } else if (other.isZero()) {
	    return Timestamp.ZERO;
	  }

	  if (this.equals(Timestamp.MIN_VALUE)) {
	    return other.isOdd() ? Timestamp.MIN_VALUE : Timestamp.ZERO;
	  } else if (other.equals(Timestamp.MIN_VALUE)) {
	    return this.isOdd() ? Timestamp.MIN_VALUE : Timestamp.ZERO;
	  }

	  if (this.isNegative()) {
	    if (other.isNegative()) {
	      return this.negate().multiply(other.negate());
	    } else {
	      return this.negate().multiply(other).negate();
	    }
	  } else if (other.isNegative()) {
	    return this.multiply(other.negate()).negate();
	  }

	  // If both Timestamps are small, use float multiplication
	  if (this.lessThan(Timestamp.TWO_PWR_24_) &&
	      other.lessThan(Timestamp.TWO_PWR_24_)) {
	    return Timestamp.fromNumber(this.toNumber() * other.toNumber());
	  }

	  // Divide each Timestamp into 4 chunks of 16 bits, and then add up 4x4 products.
	  // We can skip products that would overflow.

	  var a48 = this.high_ >>> 16;
	  var a32 = this.high_ & 0xFFFF;
	  var a16 = this.low_ >>> 16;
	  var a00 = this.low_ & 0xFFFF;

	  var b48 = other.high_ >>> 16;
	  var b32 = other.high_ & 0xFFFF;
	  var b16 = other.low_ >>> 16;
	  var b00 = other.low_ & 0xFFFF;

	  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
	  c00 += a00 * b00;
	  c16 += c00 >>> 16;
	  c00 &= 0xFFFF;
	  c16 += a16 * b00;
	  c32 += c16 >>> 16;
	  c16 &= 0xFFFF;
	  c16 += a00 * b16;
	  c32 += c16 >>> 16;
	  c16 &= 0xFFFF;
	  c32 += a32 * b00;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c32 += a16 * b16;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c32 += a00 * b32;
	  c48 += c32 >>> 16;
	  c32 &= 0xFFFF;
	  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
	  c48 &= 0xFFFF;
	  return Timestamp.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
	};

	/**
	 * Returns this Timestamp divided by the given one.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp by which to divide.
	 * @return {Timestamp} this Timestamp divided by the given one.
	 */
	Timestamp.prototype.div = function(other) {
	  if (other.isZero()) {
	    throw Error('division by zero');
	  } else if (this.isZero()) {
	    return Timestamp.ZERO;
	  }

	  if (this.equals(Timestamp.MIN_VALUE)) {
	    if (other.equals(Timestamp.ONE) ||
	        other.equals(Timestamp.NEG_ONE)) {
	      return Timestamp.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
	    } else if (other.equals(Timestamp.MIN_VALUE)) {
	      return Timestamp.ONE;
	    } else {
	      // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
	      var halfThis = this.shiftRight(1);
	      var approx = halfThis.div(other).shiftLeft(1);
	      if (approx.equals(Timestamp.ZERO)) {
	        return other.isNegative() ? Timestamp.ONE : Timestamp.NEG_ONE;
	      } else {
	        var rem = this.subtract(other.multiply(approx));
	        var result = approx.add(rem.div(other));
	        return result;
	      }
	    }
	  } else if (other.equals(Timestamp.MIN_VALUE)) {
	    return Timestamp.ZERO;
	  }

	  if (this.isNegative()) {
	    if (other.isNegative()) {
	      return this.negate().div(other.negate());
	    } else {
	      return this.negate().div(other).negate();
	    }
	  } else if (other.isNegative()) {
	    return this.div(other.negate()).negate();
	  }

	  // Repeat the following until the remainder is less than other:  find a
	  // floating-point that approximates remainder / other *from below*, add this
	  // into the result, and subtract it from the remainder.  It is critical that
	  // the approximate value is less than or equal to the real value so that the
	  // remainder never becomes negative.
	  var res = Timestamp.ZERO;
	  var rem = this;
	  while (rem.greaterThanOrEqual(other)) {
	    // Approximate the result of division. This may be a little greater or
	    // smaller than the actual value.
	    var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

	    // We will tweak the approximate result by changing it in the 48-th digit or
	    // the smallest non-fractional digit, whichever is larger.
	    var log2 = Math.ceil(Math.log(approx) / Math.LN2);
	    var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

	    // Decrease the approximation until it is smaller than the remainder.  Note
	    // that if it is too large, the product overflows and is negative.
	    var approxRes = Timestamp.fromNumber(approx);
	    var approxRem = approxRes.multiply(other);
	    while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
	      approx -= delta;
	      approxRes = Timestamp.fromNumber(approx);
	      approxRem = approxRes.multiply(other);
	    }

	    // We know the answer can't be zero... and actually, zero would cause
	    // infinite recursion since we would make no progress.
	    if (approxRes.isZero()) {
	      approxRes = Timestamp.ONE;
	    }

	    res = res.add(approxRes);
	    rem = rem.subtract(approxRem);
	  }
	  return res;
	};

	/**
	 * Returns this Timestamp modulo the given one.
	 *
	 * @method
	 * @param {Timestamp} other Timestamp by which to mod.
	 * @return {Timestamp} this Timestamp modulo the given one.
	 */
	Timestamp.prototype.modulo = function(other) {
	  return this.subtract(this.div(other).multiply(other));
	};

	/**
	 * The bitwise-NOT of this value.
	 *
	 * @method
	 * @return {Timestamp} the bitwise-NOT of this value.
	 */
	Timestamp.prototype.not = function() {
	  return Timestamp.fromBits(~this.low_, ~this.high_);
	};

	/**
	 * Returns the bitwise-AND of this Timestamp and the given one.
	 *
	 * @method
	 * @param {Timestamp} other the Timestamp with which to AND.
	 * @return {Timestamp} the bitwise-AND of this and the other.
	 */
	Timestamp.prototype.and = function(other) {
	  return Timestamp.fromBits(this.low_ & other.low_, this.high_ & other.high_);
	};

	/**
	 * Returns the bitwise-OR of this Timestamp and the given one.
	 *
	 * @method
	 * @param {Timestamp} other the Timestamp with which to OR.
	 * @return {Timestamp} the bitwise-OR of this and the other.
	 */
	Timestamp.prototype.or = function(other) {
	  return Timestamp.fromBits(this.low_ | other.low_, this.high_ | other.high_);
	};

	/**
	 * Returns the bitwise-XOR of this Timestamp and the given one.
	 *
	 * @method
	 * @param {Timestamp} other the Timestamp with which to XOR.
	 * @return {Timestamp} the bitwise-XOR of this and the other.
	 */
	Timestamp.prototype.xor = function(other) {
	  return Timestamp.fromBits(this.low_ ^ other.low_, this.high_ ^ other.high_);
	};

	/**
	 * Returns this Timestamp with bits shifted to the left by the given amount.
	 *
	 * @method
	 * @param {number} numBits the number of bits by which to shift.
	 * @return {Timestamp} this shifted to the left by the given amount.
	 */
	Timestamp.prototype.shiftLeft = function(numBits) {
	  numBits &= 63;
	  if (numBits == 0) {
	    return this;
	  } else {
	    var low = this.low_;
	    if (numBits < 32) {
	      var high = this.high_;
	      return Timestamp.fromBits(
	                 low << numBits,
	                 (high << numBits) | (low >>> (32 - numBits)));
	    } else {
	      return Timestamp.fromBits(0, low << (numBits - 32));
	    }
	  }
	};

	/**
	 * Returns this Timestamp with bits shifted to the right by the given amount.
	 *
	 * @method
	 * @param {number} numBits the number of bits by which to shift.
	 * @return {Timestamp} this shifted to the right by the given amount.
	 */
	Timestamp.prototype.shiftRight = function(numBits) {
	  numBits &= 63;
	  if (numBits == 0) {
	    return this;
	  } else {
	    var high = this.high_;
	    if (numBits < 32) {
	      var low = this.low_;
	      return Timestamp.fromBits(
	                 (low >>> numBits) | (high << (32 - numBits)),
	                 high >> numBits);
	    } else {
	      return Timestamp.fromBits(
	                 high >> (numBits - 32),
	                 high >= 0 ? 0 : -1);
	    }
	  }
	};

	/**
	 * Returns this Timestamp with bits shifted to the right by the given amount, with the new top bits matching the current sign bit.
	 *
	 * @method
	 * @param {number} numBits the number of bits by which to shift.
	 * @return {Timestamp} this shifted to the right by the given amount, with zeros placed into the new leading bits.
	 */
	Timestamp.prototype.shiftRightUnsigned = function(numBits) {
	  numBits &= 63;
	  if (numBits == 0) {
	    return this;
	  } else {
	    var high = this.high_;
	    if (numBits < 32) {
	      var low = this.low_;
	      return Timestamp.fromBits(
	                 (low >>> numBits) | (high << (32 - numBits)),
	                 high >>> numBits);
	    } else if (numBits == 32) {
	      return Timestamp.fromBits(high, 0);
	    } else {
	      return Timestamp.fromBits(high >>> (numBits - 32), 0);
	    }
	  }
	};

	/**
	 * Returns a Timestamp representing the given (32-bit) integer value.
	 *
	 * @method
	 * @param {number} value the 32-bit integer in question.
	 * @return {Timestamp} the corresponding Timestamp value.
	 */
	Timestamp.fromInt = function(value) {
	  if (-128 <= value && value < 128) {
	    var cachedObj = Timestamp.INT_CACHE_[value];
	    if (cachedObj) {
	      return cachedObj;
	    }
	  }

	  var obj = new Timestamp(value | 0, value < 0 ? -1 : 0);
	  if (-128 <= value && value < 128) {
	    Timestamp.INT_CACHE_[value] = obj;
	  }
	  return obj;
	};

	/**
	 * Returns a Timestamp representing the given value, provided that it is a finite number. Otherwise, zero is returned.
	 *
	 * @method
	 * @param {number} value the number in question.
	 * @return {Timestamp} the corresponding Timestamp value.
	 */
	Timestamp.fromNumber = function(value) {
	  if (isNaN(value) || !isFinite(value)) {
	    return Timestamp.ZERO;
	  } else if (value <= -Timestamp.TWO_PWR_63_DBL_) {
	    return Timestamp.MIN_VALUE;
	  } else if (value + 1 >= Timestamp.TWO_PWR_63_DBL_) {
	    return Timestamp.MAX_VALUE;
	  } else if (value < 0) {
	    return Timestamp.fromNumber(-value).negate();
	  } else {
	    return new Timestamp(
	               (value % Timestamp.TWO_PWR_32_DBL_) | 0,
	               (value / Timestamp.TWO_PWR_32_DBL_) | 0);
	  }
	};

	/**
	 * Returns a Timestamp representing the 64-bit integer that comes by concatenating the given high and low bits. Each is assumed to use 32 bits.
	 *
	 * @method
	 * @param {number} lowBits the low 32-bits.
	 * @param {number} highBits the high 32-bits.
	 * @return {Timestamp} the corresponding Timestamp value.
	 */
	Timestamp.fromBits = function(lowBits, highBits) {
	  return new Timestamp(lowBits, highBits);
	};

	/**
	 * Returns a Timestamp representation of the given string, written using the given radix.
	 *
	 * @method
	 * @param {string} str the textual representation of the Timestamp.
	 * @param {number} opt_radix the radix in which the text is written.
	 * @return {Timestamp} the corresponding Timestamp value.
	 */
	Timestamp.fromString = function(str, opt_radix) {
	  if (str.length == 0) {
	    throw Error('number format error: empty string');
	  }

	  var radix = opt_radix || 10;
	  if (radix < 2 || 36 < radix) {
	    throw Error('radix out of range: ' + radix);
	  }

	  if (str.charAt(0) == '-') {
	    return Timestamp.fromString(str.substring(1), radix).negate();
	  } else if (str.indexOf('-') >= 0) {
	    throw Error('number format error: interior "-" character: ' + str);
	  }

	  // Do several (8) digits each time through the loop, so as to
	  // minimize the calls to the very expensive emulated div.
	  var radixToPower = Timestamp.fromNumber(Math.pow(radix, 8));

	  var result = Timestamp.ZERO;
	  for (var i = 0; i < str.length; i += 8) {
	    var size = Math.min(8, str.length - i);
	    var value = parseInt(str.substring(i, i + size), radix);
	    if (size < 8) {
	      var power = Timestamp.fromNumber(Math.pow(radix, size));
	      result = result.multiply(power).add(Timestamp.fromNumber(value));
	    } else {
	      result = result.multiply(radixToPower);
	      result = result.add(Timestamp.fromNumber(value));
	    }
	  }
	  return result;
	};

	// NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
	// from* methods on which they depend.


	/**
	 * A cache of the Timestamp representations of small integer values.
	 * @type {Object}
	 * @ignore
	 */
	Timestamp.INT_CACHE_ = {};

	// NOTE: the compiler should inline these constant values below and then remove
	// these variables, so there should be no runtime penalty for these.

	/**
	 * Number used repeated below in calculations.  This must appear before the
	 * first call to any from* function below.
	 * @type {number}
	 * @ignore
	 */
	Timestamp.TWO_PWR_16_DBL_ = 1 << 16;

	/**
	 * @type {number}
	 * @ignore
	 */
	Timestamp.TWO_PWR_24_DBL_ = 1 << 24;

	/**
	 * @type {number}
	 * @ignore
	 */
	Timestamp.TWO_PWR_32_DBL_ = Timestamp.TWO_PWR_16_DBL_ * Timestamp.TWO_PWR_16_DBL_;

	/**
	 * @type {number}
	 * @ignore
	 */
	Timestamp.TWO_PWR_31_DBL_ = Timestamp.TWO_PWR_32_DBL_ / 2;

	/**
	 * @type {number}
	 * @ignore
	 */
	Timestamp.TWO_PWR_48_DBL_ = Timestamp.TWO_PWR_32_DBL_ * Timestamp.TWO_PWR_16_DBL_;

	/**
	 * @type {number}
	 * @ignore
	 */
	Timestamp.TWO_PWR_64_DBL_ = Timestamp.TWO_PWR_32_DBL_ * Timestamp.TWO_PWR_32_DBL_;

	/**
	 * @type {number}
	 * @ignore
	 */
	Timestamp.TWO_PWR_63_DBL_ = Timestamp.TWO_PWR_64_DBL_ / 2;

	/** @type {Timestamp} */
	Timestamp.ZERO = Timestamp.fromInt(0);

	/** @type {Timestamp} */
	Timestamp.ONE = Timestamp.fromInt(1);

	/** @type {Timestamp} */
	Timestamp.NEG_ONE = Timestamp.fromInt(-1);

	/** @type {Timestamp} */
	Timestamp.MAX_VALUE =
	    Timestamp.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);

	/** @type {Timestamp} */
	Timestamp.MIN_VALUE = Timestamp.fromBits(0, 0x80000000 | 0);

	/**
	 * @type {Timestamp}
	 * @ignore
	 */
	Timestamp.TWO_PWR_24_ = Timestamp.fromInt(1 << 24);

	/**
	 * Expose.
	 */
	module.exports = Timestamp;
	module.exports.Timestamp = Timestamp;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(module, global) {/*! https://mths.be/base64 v0.1.0 by @mathias | MIT license */
	;(function(root) {

		// Detect free variables `exports`.
		var freeExports = typeof exports == 'object' && exports;

		// Detect free variable `module`.
		var freeModule = typeof module == 'object' && module &&
			module.exports == freeExports && module;

		// Detect free variable `global`, from Node.js or Browserified code, and use
		// it as `root`.
		var freeGlobal = typeof global == 'object' && global;
		if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
			root = freeGlobal;
		}

		/*--------------------------------------------------------------------------*/

		var InvalidCharacterError = function(message) {
			this.message = message;
		};
		InvalidCharacterError.prototype = new Error;
		InvalidCharacterError.prototype.name = 'InvalidCharacterError';

		var error = function(message) {
			// Note: the error messages used throughout this file match those used by
			// the native `atob`/`btoa` implementation in Chromium.
			throw new InvalidCharacterError(message);
		};

		var TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		// http://whatwg.org/html/common-microsyntaxes.html#space-character
		var REGEX_SPACE_CHARACTERS = /[\t\n\f\r ]/g;

		// `decode` is designed to be fully compatible with `atob` as described in the
		// HTML Standard. http://whatwg.org/html/webappapis.html#dom-windowbase64-atob
		// The optimized base64-decoding algorithm used is based on @atk’s excellent
		// implementation. https://gist.github.com/atk/1020396
		var decode = function(input) {
			input = String(input)
				.replace(REGEX_SPACE_CHARACTERS, '');
			var length = input.length;
			if (length % 4 == 0) {
				input = input.replace(/==?$/, '');
				length = input.length;
			}
			if (
				length % 4 == 1 ||
				// http://whatwg.org/C#alphanumeric-ascii-characters
				/[^+a-zA-Z0-9/]/.test(input)
			) {
				error(
					'Invalid character: the string to be decoded is not correctly encoded.'
				);
			}
			var bitCounter = 0;
			var bitStorage;
			var buffer;
			var output = '';
			var position = -1;
			while (++position < length) {
				buffer = TABLE.indexOf(input.charAt(position));
				bitStorage = bitCounter % 4 ? bitStorage * 64 + buffer : buffer;
				// Unless this is the first of a group of 4 characters…
				if (bitCounter++ % 4) {
					// …convert the first 8 bits to a single ASCII character.
					output += String.fromCharCode(
						0xFF & bitStorage >> (-2 * bitCounter & 6)
					);
				}
			}
			return output;
		};

		// `encode` is designed to be fully compatible with `btoa` as described in the
		// HTML Standard: http://whatwg.org/html/webappapis.html#dom-windowbase64-btoa
		var encode = function(input) {
			input = String(input);
			if (/[^\0-\xFF]/.test(input)) {
				// Note: no need to special-case astral symbols here, as surrogates are
				// matched, and the input is supposed to only contain ASCII anyway.
				error(
					'The string to be encoded contains characters outside of the ' +
					'Latin1 range.'
				);
			}
			var padding = input.length % 3;
			var output = '';
			var position = -1;
			var a;
			var b;
			var c;
			var d;
			var buffer;
			// Make sure any padding is handled outside of the loop.
			var length = input.length - padding;

			while (++position < length) {
				// Read three bytes, i.e. 24 bits.
				a = input.charCodeAt(position) << 16;
				b = input.charCodeAt(++position) << 8;
				c = input.charCodeAt(++position);
				buffer = a + b + c;
				// Turn the 24 bits into four chunks of 6 bits each, and append the
				// matching character for each of them to the output.
				output += (
					TABLE.charAt(buffer >> 18 & 0x3F) +
					TABLE.charAt(buffer >> 12 & 0x3F) +
					TABLE.charAt(buffer >> 6 & 0x3F) +
					TABLE.charAt(buffer & 0x3F)
				);
			}

			if (padding == 2) {
				a = input.charCodeAt(position) << 8;
				b = input.charCodeAt(++position);
				buffer = a + b;
				output += (
					TABLE.charAt(buffer >> 10) +
					TABLE.charAt((buffer >> 4) & 0x3F) +
					TABLE.charAt((buffer << 2) & 0x3F) +
					'='
				);
			} else if (padding == 1) {
				buffer = input.charCodeAt(position);
				output += (
					TABLE.charAt(buffer >> 2) +
					TABLE.charAt((buffer << 4) & 0x3F) +
					'=='
				);
			}

			return output;
		};

		var base64 = {
			'encode': encode,
			'decode': decode,
			'version': '0.1.0'
		};

		// Some AMD build optimizers, like r.js, check for specific condition patterns
		// like the following:
		if (
			true
		) {
			!(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
				return base64;
			}.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
		}	else if (freeExports && !freeExports.nodeType) {
			if (freeModule) { // in Node.js or RingoJS v0.8.0+
				freeModule.exports = base64;
			} else { // in Narwhal or RingoJS v0.7.0-
				for (var key in base64) {
					base64.hasOwnProperty(key) && (freeExports[key] = base64[key]);
				}
			}
		} else { // in Rhino or a web browser
			root.base64 = base64;
		}

	}(this));

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(30)(module), (function() { return this; }())))

/***/ },
/* 30 */
/***/ function(module, exports) {

	module.exports = function(module) {
		if(!module.webpackPolyfill) {
			module.deprecate = function() {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	}


/***/ },
/* 31 */
/***/ function(module, exports) {

	"use strict"

	class Callbacks {
	  constructor() {
	    this.callbacks = {};
	    this._id = 0;
	    this.cursors = {};
	  }

	  id() {
	    return (this._id++) % Number.MAX_VALUE;
	  }

	  add(id, callback) {
	    this.callbacks[id] = callback;
	  }

	  remove(id) {
	    // Get the callback
	    var callback = this.callbacks[id];
	    // Delete the callback
	    delete this.callbacks[id];
	    // Return the callback
	    return callback;
	  }

	  call(id, err, reply) {
	    if(!this.callbacks[id]) {
	      throw new Error('could not locate callback for id ' + id);
	    }

	    // Get the callback
	    var callback = this.callbacks[id];
	    // Delete the callback
	    delete this.callbacks[id];
	    // Perform the callback
	    callback(err, reply);
	  }

	  flush(err) {
	    var keys = Object.keys(this.callbacks);
	    // Execute all the callbacks with the error
	    for(var i = 0; i < keys.length; i++) {
	      this.call(keys[i], err);
	    }
	  }

	  //
	  // Infrastructure allowing us to listen to changing queries
	  //
	  update(object) {
	    // Do we have a cursor matching the update
	    // Emit added/changed/removed event for the updateObject
	    if(this.cursors[object.id]) {
	      if(object.type == 'changed' || object.type == 'added') {
	        this.cursors[object.id].emit(object.type, object.doc, object.fields);
	      } else if(object.type == 'removed') {
	        this.cursors[object.id].emit(object.type, object.doc);
	      }
	    }

	    //
	    // TODO: What to do if there are updates that have no known cursors on the client side
	    //  - Send killcursors commands
	  }

	  liveQuery(cursor) {
	    this.cursors[cursor.liveQueryId] = cursor;
	  }

	  unlisten(cursor) {
	    delete this.cursors[cursor.cursorId];
	  }
	}

	module.exports = Callbacks;


/***/ },
/* 32 */
/***/ function(module, exports) {

	"use strict"

	class MongoError extends Error {
	  constructor(object) {
	    super();
	    Object.assign(this, object);
	  }
	}

	module.exports = MongoError;


/***/ },
/* 33 */
/***/ function(module, exports) {

	
	/**
	 * slice() reference.
	 */

	var slice = Array.prototype.slice;

	/**
	 * Expose `co`.
	 */

	module.exports = co['default'] = co.co = co;

	/**
	 * Wrap the given generator `fn` into a
	 * function that returns a promise.
	 * This is a separate function so that
	 * every `co()` call doesn't create a new,
	 * unnecessary closure.
	 *
	 * @param {GeneratorFunction} fn
	 * @return {Function}
	 * @api public
	 */

	co.wrap = function (fn) {
	  createPromise.__generatorFunction__ = fn;
	  return createPromise;
	  function createPromise() {
	    return co.call(this, fn.apply(this, arguments));
	  }
	};

	/**
	 * Execute the generator function or a generator
	 * and return a promise.
	 *
	 * @param {Function} fn
	 * @return {Promise}
	 * @api public
	 */

	function co(gen) {
	  var ctx = this;
	  if (typeof gen === 'function') gen = gen.call(this);
	  // we wrap everything in a promise to avoid promise chaining,
	  // which leads to memory leak errors.
	  // see https://github.com/tj/co/issues/180
	  return new Promise(function(resolve, reject) {
	    onFulfilled();

	    /**
	     * @param {Mixed} res
	     * @return {Promise}
	     * @api private
	     */

	    function onFulfilled(res) {
	      var ret;
	      try {
	        ret = gen.next(res);
	      } catch (e) {
	        return reject(e);
	      }
	      next(ret);
	    }

	    /**
	     * @param {Error} err
	     * @return {Promise}
	     * @api private
	     */

	    function onRejected(err) {
	      var ret;
	      try {
	        ret = gen.throw(err);
	      } catch (e) {
	        return reject(e);
	      }
	      next(ret);
	    }

	    /**
	     * Get the next value in the generator,
	     * return a promise.
	     *
	     * @param {Object} ret
	     * @return {Promise}
	     * @api private
	     */

	    function next(ret) {
	      if (ret.done) return resolve(ret.value);
	      var value = toPromise.call(ctx, ret.value);
	      if (value && isPromise(value)) return value.then(onFulfilled, onRejected);
	      return onRejected(new TypeError('You may only yield a function, promise, generator, array, or object, '
	        + 'but the following object was passed: "' + String(ret.value) + '"'));
	    }
	  });
	}

	/**
	 * Convert a `yield`ed value into a promise.
	 *
	 * @param {Mixed} obj
	 * @return {Promise}
	 * @api private
	 */

	function toPromise(obj) {
	  if (!obj) return obj;
	  if (isPromise(obj)) return obj;
	  if (isGeneratorFunction(obj) || isGenerator(obj)) return co.call(this, obj);
	  if ('function' == typeof obj) return thunkToPromise.call(this, obj);
	  if (Array.isArray(obj)) return arrayToPromise.call(this, obj);
	  if (isObject(obj)) return objectToPromise.call(this, obj);
	  return obj;
	}

	/**
	 * Convert a thunk to a promise.
	 *
	 * @param {Function}
	 * @return {Promise}
	 * @api private
	 */

	function thunkToPromise(fn) {
	  var ctx = this;
	  return new Promise(function (resolve, reject) {
	    fn.call(ctx, function (err, res) {
	      if (err) return reject(err);
	      if (arguments.length > 2) res = slice.call(arguments, 1);
	      resolve(res);
	    });
	  });
	}

	/**
	 * Convert an array of "yieldables" to a promise.
	 * Uses `Promise.all()` internally.
	 *
	 * @param {Array} obj
	 * @return {Promise}
	 * @api private
	 */

	function arrayToPromise(obj) {
	  return Promise.all(obj.map(toPromise, this));
	}

	/**
	 * Convert an object of "yieldables" to a promise.
	 * Uses `Promise.all()` internally.
	 *
	 * @param {Object} obj
	 * @return {Promise}
	 * @api private
	 */

	function objectToPromise(obj){
	  var results = new obj.constructor();
	  var keys = Object.keys(obj);
	  var promises = [];
	  for (var i = 0; i < keys.length; i++) {
	    var key = keys[i];
	    var promise = toPromise.call(this, obj[key]);
	    if (promise && isPromise(promise)) defer(promise, key);
	    else results[key] = obj[key];
	  }
	  return Promise.all(promises).then(function () {
	    return results;
	  });

	  function defer(promise, key) {
	    // predefine the key in the result
	    results[key] = undefined;
	    promises.push(promise.then(function (res) {
	      results[key] = res;
	    }));
	  }
	}

	/**
	 * Check if `obj` is a promise.
	 *
	 * @param {Object} obj
	 * @return {Boolean}
	 * @api private
	 */

	function isPromise(obj) {
	  return 'function' == typeof obj.then;
	}

	/**
	 * Check if `obj` is a generator.
	 *
	 * @param {Mixed} obj
	 * @return {Boolean}
	 * @api private
	 */

	function isGenerator(obj) {
	  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
	}

	/**
	 * Check if `obj` is a generator function.
	 *
	 * @param {Mixed} obj
	 * @return {Boolean}
	 * @api private
	 */
	function isGeneratorFunction(obj) {
	  var constructor = obj.constructor;
	  if (!constructor) return false;
	  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
	  return isGenerator(constructor.prototype);
	}

	/**
	 * Check for plain object.
	 *
	 * @param {Mixed} val
	 * @return {Boolean}
	 * @api private
	 */

	function isObject(val) {
	  return Object == val.constructor;
	}


/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	/// reduced to ~ 410 LOCs (parser only 300 vs. 1400+) with (some, needed) BSON classes "inlined".
	/// Compare ~ 4,300 (22KB vs. 157KB) in browser build at: https://github.com/mongodb/js-bson/blob/master/browser_build/bson.js

	var Long = __webpack_require__(14),
	  ObjectID = __webpack_require__(21),
	  MinKey = __webpack_require__(20),
	  MaxKey = __webpack_require__(19),
	  Timestamp = __webpack_require__(28);

	// JS MAX PRECISE VALUES
	var JS_INT_MAX = 0x20000000000000;  // Any integer up to 2^53 can be precisely represented by a double.
	var JS_INT_MIN = -0x20000000000000;  // Any integer down to -2^53 can be precisely represented by a double.

	var readIEEE754 = function(buffer, offset, endian, mLen, nBytes) {
	  var e, m,
	      bBE = (endian === 'big'),
	      eLen = nBytes * 8 - mLen - 1,
	      eMax = (1 << eLen) - 1,
	      eBias = eMax >> 1,
	      nBits = -7,
	      i = bBE ? 0 : (nBytes - 1),
	      d = bBE ? 1 : -1,
	      s = buffer[offset + i];

	  i += d;

	  e = s & ((1 << (-nBits)) - 1);
	  s >>= (-nBits);
	  nBits += eLen;
	  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

	  m = e & ((1 << (-nBits)) - 1);
	  e >>= (-nBits);
	  nBits += mLen;
	  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

	  if (e === 0) {
	    e = 1 - eBias;
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity);
	  } else {
	    m = m + Math.pow(2, mLen);
	    e = e - eBias;
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
	};

	module.exports.deserializeFast = deserializeFast;

	function deserializeFast(buffer, i, isArray){   //// , options, isArray) {       //// no more options!
	    if (buffer.length < 5) return new Error('Corrupt bson message < 5 bytes long'); /// from 'throw'
	    var elementType, tempindex = 0, name;
	    var string, low, high;              /// = lowBits / highBits
	                                        /// using 'i' as the index to keep the lines shorter:
	    i || ( i = 0 );  /// for parseResponse it's 0; set to running index in deserialize(object/array) recursion
	    var object = isArray ? [] : {};         /// needed for type ARRAY recursion later!
	    var size = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	    if(size < 5 || size > buffer.length) return new Error('Corrupt BSON message');
	/// 'size' var was not used by anything after this, so we can reuse it

	    while(true) {                           // While we have more left data left keep parsing
	      elementType = buffer[i++];          // Read the type
	      if (elementType === 0) break;       // If we get a zero it's the last byte, exit

	      tempindex = i;  /// inlined readCStyleString & removed extra i<buffer.length check slowing EACH loop!
	      while( buffer[tempindex] !== 0x00 ) tempindex++;  /// read ahead w/out changing main 'i' index
	      if (tempindex >= buffer.length) return new Error('Corrupt BSON document: illegal CString')
	      name = buffer.toString('utf8', i, tempindex);
	      i = tempindex + 1;               /// Update index position to after the string + '0' termination

	      switch(elementType) {

	        case 7:     /// = BSON.BSON_DATA_OID:
	          var array = new Array(12);
	          for(var j = 0; j < 12; j++) {
	            array[j] = String.fromCharCode(buffer[i+j]);
	          }

	          i = i + 12;
	          object[name] = new ObjectID(array.join(''));   ///... & attach to the new ObjectID instance
	          break;

	        case 2:     /// = BSON.BSON_DATA_STRING:
	          size = buffer[i++] | buffer[i++] <<8 | buffer[i++] <<16 | buffer[i++] <<24;
	          object[name] = buffer.toString('utf8', i, i += size -1 );
	          i++;
	          break;          /// need to get the '0' index "tick-forward" back!

	        case 16:    /// = BSON.BSON_DATA_INT:        // Decode the 32bit value
	          object[name] = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	          break;

	        case 1:     /// = BSON.BSON_DATA_NUMBER:     // Decode the double value
	          object[name] = readIEEE754(buffer, i, 'little', 52, 8);
	          i += 8;
	          break;

	        case 8:     /// = BSON.BSON_DATA_BOOLEAN:
	          object[name] = buffer[i++] == 1;
	          break;

	        case 6:     /// = BSON.BSON_DATA_UNDEFINED:     /// deprecated
	        case 10:    /// = BSON.BSON_DATA_NULL:
	          object[name] = null;
	          break;

	        case 4:     /// = BSON.BSON_DATA_ARRAY
	          size = buffer[i] | buffer[i+1] <<8 | buffer[i+2] <<16 | buffer[i+3] <<24;  /// NO 'i' increment since the size bytes are reread during the recursion!
	          object[name] = deserializeFast(buffer, i, true );  /// pass current index & set isArray = true
	          i += size;
	          break;
	        case 3:     /// = BSON.BSON_DATA_OBJECT:
	          size = buffer[i] | buffer[i+1] <<8 | buffer[i+2] <<16 | buffer[i+3] <<24;
	          object[name] = deserializeFast(buffer, i, false );          /// isArray = false => Object
	          i += size;
	          break;

	        case 5:     /// = BSON.BSON_DATA_BINARY:             // Decode the size of the binary blob
	          size = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	          buffer[i++];             /// Skip, as we assume always default subtype, i.e. 0!
	          object[name] = buffer.slice(i, i += size); 
	          break;

	        case 9:     /// = BSON.BSON_DATA_DATE:      /// SEE notes below on the Date type vs. other options...
	          low  = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	          high = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	          object[name] = new Date( high * 4294967296 + (low < 0 ? low + 4294967296 : low) );
	          break;

	        case 18:    /// = BSON.BSON_DATA_LONG:  /// usage should be somewhat rare beyond parseResponse() -> cursorId, where it is handled inline, NOT as part of deserializeFast(returnedObjects); get lowBits, highBits:
	          low  = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	          high = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;

	          // size = high * 4294967296 + (low < 0 ? low + 4294967296 : low);      /// from long.toNumber()
	          object[name] = new Long(low, high);
	          break;
	          // if (size < JS_INT_MAX && size > JS_INT_MIN) object[name] = size;    /// positive # more likely!
	          // else object[name] = new Long(low, high);    break;

	        case 127:   /// = BSON.BSON_DATA_MIN_KEY:   /// do we EVER actually get these BACK from MongoDB server?!
	          object[name] = new MinKey();
	          break;
	        case 255:   /// = BSON.BSON_DATA_MAX_KEY:
	          object[name] = new MaxKey();
	          break;

	        case 17:    /// = BSON.BSON_DATA_TIMESTAMP:   /// somewhat obscure internal BSON type; MongoDB uses it for (pseudo) high-res time timestamp (past millisecs precision is just a counter!) in the Oplog ts: field, etc.
	          low  = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	          high = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
	          object[name] = new Timestamp(low, high);
	          break;

	///        case 11:    /// = RegExp is skipped; we should NEVER be getting any from the MongoDB server!?
	        }   /// end of switch(elementType)
	    }   /// end of while(1)
	    return object;  // Return the finalized object
	}


/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var Collection = __webpack_require__(36),
	  serialize = __webpack_require__(2).serialize;

	class Db {
	  constructor(name, channel, transport, store) {
	    this.name = name;
	    this.channel = channel;
	    this.transport = transport;
	    this.store = store;
	  }

	  collection(name) {
	    return new Collection(name, this);
	  }

	  //
	  // Supports one or more operations, allowing for batching up
	  // of command to save on round-trips to the server
	  command(op, options) {
	    var self = this;
	    options = options || {};

	    // Return the promise
	    return new Promise(function(resolve, reject) {
	      // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 0")
	      // console.dir(op)
	      // op = ;
	      // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 1")
	      // console.dir(op)
	      // Final batch op sent to the server
	      var cmd = {
	        _id: self.store.id(),
	        op: serialize(op)
	      };

	      // Add a listener to the store
	      self.store.add(cmd._id, function(err, result) {
	        if(err) return reject(err);
	        resolve(options.fullResult ? result : result.result);
	      });

	      // Write the operation out on the transport (with a group id)
	      self.transport.write(self.channel, cmd);
	    });
	  }
	}

	module.exports = Db;


/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var Promise = __webpack_require__(2).Promise,
	  AggregationCursor = __webpack_require__(37),
	  Cursor = __webpack_require__(40);

	class Collection {
	  constructor(name, db) {
	    this.name = name;
	    this.db = db;
	    this.namespace = db.name + "." + name;
	  }

	  /**
	   * Inserts a single document into MongoDB. If documents passed in do not contain the **_id** field,
	   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
	   * can be overridden by setting the **forceServerObjectId** flag.
	   *
	   * @method
	   * @param {object} doc Document to insert.
	   * @param {object} [options=null] Optional settings.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  insertOne(document, options) {
	    return this.db.command(Object.assign({
	        insertOne: this.namespace,
	        doc: document,
	      }, options || {})
	    );
	  }

	  /**
	   * Inserts an array of documents into MongoDB. If documents passed in do not contain the **_id** field,
	   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
	   * can be overridden by setting the **forceServerObjectId** flag.
	   *
	   * @method
	   * @param {object[]} docs Documents to insert.
	   * @param {object} [options=null] Optional settings.
	   * @param {boolean} [options.ordered=true] Execute write operation in ordered or unordered fashion.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  insertMany(documents, options) {
	    return this.db.command(Object.assign({
	        insertMany: this.namespace,
	        docs: documents,
	      }, options || {})
	    );
	  }

	  /**
	   * Update a single document on MongoDB
	   * @method
	   * @param {object} filter The Filter used to select the document to update
	   * @param {object} update The update operations to be applied to the document
	   * @param {object} [options=null] Optional settings.
	   * @param {boolean} [options.upsert=false] Update operation is an upsert.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  updateOne(filter, update, options) {
	    return this.db.command(Object.assign({
	        updateOne: this.namespace,
	        q: filter,
	        u: update
	      }, options || {})
	    );
	  }

	  /**
	   * Update multiple documents on MongoDB
	   * @method
	   * @param {object} filter The Filter used to select the document to update
	   * @param {object} update The update operations to be applied to the document
	   * @param {object} [options=null] Optional settings.
	   * @param {boolean} [options.upsert=false] Update operation is an upsert.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  updateMany(filter, update, options) {
	    return this.db.command(Object.assign({
	        updateMany: this.namespace,
	        q: filter,
	        u: update
	      }, options || {})
	    );
	  }

	  /**
	   * Replace a document on MongoDB
	   * @method
	   * @param {object} filter The Filter used to select the document to update
	   * @param {object} doc The Document that replaces the matching document
	   * @param {object} [options=null] Optional settings.
	   * @param {boolean} [options.upsert=false] Update operation is an upsert.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  replaceOne(filter, doc, options) {
	    return this.db.command(Object.assign({
	        replaceOne: this.namespace,
	        q: filter,
	        u: doc
	      }, options || {})
	    );
	  }

	  /**
	   * Delete a document on MongoDB
	   * @method
	   * @param {object} filter The Filter used to select the document to remove
	   * @param {object} [options=null] Optional settings.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  deleteOne(filter, options) {
	    return this.db.command(Object.assign({
	        deleteOne: this.namespace,
	        q: filter,
	      }, options || {})
	    );
	  }

	  /**
	   * Delete multiple documents on MongoDB
	   * @method
	   * @param {object} filter The Filter used to select the documents to remove
	   * @param {object} [options=null] Optional settings.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  deleteMany(filter, options) {
	    return this.db.command(Object.assign({
	        deleteMany: this.namespace,
	        q: filter,
	      }, options || {})
	    );
	  }

	  /**
	   * Find a document and delete it in one atomic operation, requires a write lock for the duration of the operation.
	   *
	   * @method
	   * @param {object} filter Document selection filter.
	   * @param {object} [options=null] Optional settings.
	   * @param {object} [options.projection=null] Limits the fields to return for all matching documents.
	   * @param {object} [options.sort=null] Determines which document the operation modifies if the query selects multiple documents.
	   * @param {number} [options.maxTimeMS=null] The maximum amount of time to allow the query to run.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @return {Promise} returns Promise
	   */
	  findOneAndDelete(filter, options) {
	    return this.db.command(Object.assign({
	        findOneAndDelete: this.namespace,
	        q: filter,
	      }, options || {})
	    );
	  }

	  /**
	   * Find a document and update it in one atomic operation, requires a write lock for the duration of the operation.
	   *
	   * @method
	   * @param {object} filter Document selection filter.
	   * @param {object} update Update operations to be performed on the document
	   * @param {object} [options=null] Optional settings.
	   * @param {object} [options.projection=null] Limits the fields to return for all matching documents.
	   * @param {object} [options.sort=null] Determines which document the operation modifies if the query selects multiple documents.
	   * @param {number} [options.maxTimeMS=null] The maximum amount of time to allow the query to run.
	   * @param {boolean} [options.upsert=false] Upsert the document if it does not exist.
	   * @param {boolean} [options.returnOriginal=true] When false, returns the updated document rather than the original. The default is true.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @return {Promise} returns Promise
	   */
	  findOneAndUpdate(filter, update, options) {
	    return this.db.command(Object.assign({
	        findOneAndUpdate: this.namespace,
	        q: filter,
	        u: update
	      }, options || {})
	    );
	  }

	  /**
	   * Find a document and replace it in one atomic operation, requires a write lock for the duration of the operation.
	   *
	   * @method
	   * @param {object} filter Document selection filter.
	   * @param {object} replacement Document replacing the matching document.
	   * @param {object} [options=null] Optional settings.
	   * @param {object} [options.projection=null] Limits the fields to return for all matching documents.
	   * @param {object} [options.sort=null] Determines which document the operation modifies if the query selects multiple documents.
	   * @param {number} [options.maxTimeMS=null] The maximum amount of time to allow the query to run.
	   * @param {boolean} [options.upsert=false] Upsert the document if it does not exist.
	   * @param {boolean} [options.returnOriginal=true] When false, returns the updated document rather than the original. The default is true.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @return {Promise} returns Promise
	   */
	  findOneAndReplace(filter, replace, options) {
	    return this.db.command(Object.assign({
	        findOneAndReplace: this.namespace,
	        q: filter,
	        u: replace
	      }, options || {})
	    );
	  }

	  /**
	   * Perform a bulkWrite operation without a fluent API
	   *
	   * Legal operation types are
	   *
	   *  { insertOne: { document: { a: 1 } } }
	   *
	   *  { updateOne: { filter: {a:2}, update: {$set: {a:2}}, upsert:true } }
	   *
	   *  { updateMany: { filter: {a:2}, update: {$set: {a:2}}, upsert:true } }
	   *
	   *  { deleteOne: { filter: {c:1} } }
	   *
	   *  { deleteMany: { filter: {c:1} } }
	   *
	   *  { replaceOne: { filter: {c:3}, replacement: {c:4}, upsert:true}}
	   *
	   * If documents passed in do not contain the **_id** field,
	   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
	   * can be overridden by setting the **forceServerObjectId** flag.
	   *
	   * @method
	   * @param {object[]} operations Bulk operations to perform.
	   * @param {object} [options=null] Optional settings.
	   * @param {(number|string)} [options.w=null] The write concern.
	   * @param {number} [options.wtimeout=null] The write concern timeout.
	   * @param {boolean} [options.ordered=true] Execute write operation in ordered or unordered fashion.
	   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
	   * @param {string|number} [options.w=null] Write concern for the write operation.
	   * @param {boolean} [options.j=null] Wait for journal flush on write.
	   * @param {number} [options.wtimeout=null] Write concern timeout.
	   * @return {Promise} returns Promise
	   */
	  bulkWrite(operations, options) {
	    return this.db.command({
	      ns: this.namespace,
	      bulkWrite: Object.assign({ops: operations}, options || {})
	    });
	  }

	  /**
	   * Creates a cursor for a query that can be used to iterate over results from MongoDB
	   * @method
	   * @param {object} query The cursor query object.
	   * @throws {MongoError}
	   * @return {Cursor}
	   */
	  find(query) {
	    return new Cursor(this.db, this, query);
	  }

	  /**
	   * Creates an aggregation cursor for a query that can be used to iterate over results from MongoDB
	   * @method
	   * @param {array} pipeline The cursor pipeline object.
	   * @throws {MongoError}
	   * @return {Cursor}
	   */
	  aggregate(pipeline) {
	    return new AggregationCursor({
	      aggregate: this.namespace, pipeline: pipeline
	    }, this.db, this);
	  }
	}

	module.exports = Collection;


/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var CommandCursor = __webpack_require__(38);

	class AggregationCursor extends CommandCursor {
	  constructor(cmd, db, collection) {
	    super(cmd, db, collection);
	  }

	  batchSize(value) {
	    if(!this.cmd.cursor) this.cmd.cursor = {};
	    this.options.batchSize = value;
	    this.cmd.cursor.batchSize = value;
	    return this;
	  }
	}

	module.exports = AggregationCursor;


/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var Promise = __webpack_require__(2).Promise,
	  nextTick = __webpack_require__(2).nextTick,
	  EventEmitter = __webpack_require__(39),
	  co = __webpack_require__(33);

	class CommandCursor extends EventEmitter {
	  constructor(cmd, db, collection) {
	    super();
	    this.cmd = cmd;
	    this.db = db;
	    this.collection = collection;

	    // State of the cursor
	    this.state = 'init';
	    this.documents = [];
	    this.cursorId = null;
	    // Currently selected document
	    this.document = null;
	    // The options
	    this.options = {};
	  }

	  //
	  // Properties implementation
	  //
	  setReadPreference(mode, tags) {
	    this.options.readPreference = { mode: mode, tags: tags };
	    return this;
	  }

	  maxTimeMS(value) {
	    this.options.maxTimeMS = value;
	    return this;
	  }

	  batchSize(value) {
	    this.options.batchSize = value;
	    return this;
	  }

	  //
	  // Function implementations
	  //

	  /**
	   * Check if cursor contains more documents
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  hasNext() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      co(function*() {
	        if(self.document) return resolve(true);
	        self.document = yield self.next();
	        if(self.document == null) return resolve(false);
	        resolve(true);
	      }).catch(reject);
	    });
	  }

	  /**
	   * Get the next document available in the cursor
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  next() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      // User called hasNext, return the existing document first
	      if(self.state == 'destroyed') return reject(new Error('cursor exhausted or destroyed'));
	      if(self.document) {
	        var doc = self.document;
	        self.document = null;
	        return resolve(doc);
	      }

	      // We have documents left, resolve the next
	      if(self.documents.length > 0) {
	        return resolve(self.documents.shift());
	      } else if(self.documents.length == 0
	        && self.state == 'init') {

	        //
	        // Cursor was just opened, need to fire FIND command
	        co(function*() {
	          // Execute the find command
	          var r = yield self.db.command(self.cmd, {fullResult:true});

	          // Get the connection identifier
	          self.connection = r.connection;
	          r = r.result;

	          // Add the documents to the end
	          self.documents = self.documents.concat(r.cursor.firstBatch);
	          self.cursorId = r.cursor.id;

	          // Are we listening
	          if(self.options.listen && self.cursorId != null) {
	            self.db.store.listen(self);
	          }

	          // Return the first document
	          var doc = self.documents.shift();
	          // We have no results
	          if(doc === undefined) {
	            self.state = 'destroyed';
	            return resolve(null);
	          }

	          // Set the state to open
	          self.state = 'open';
	          // Return the document
	          resolve(doc);
	        }).catch(reject);
	      } else if(self.documents.length == 0
	        && self.state == 'open' && self.cursorId == null) {

	        //
	        // Cursor is dead
	        self.state = 'destroyed';
	        resolve(null);
	      } else if(self.documents.length == 0
	        && self.state == 'open') {

	        // Cursor id === 0 and no documents left === exhausted cursor.
	        if(self.cursorId.isZero()) {
	          self.state = 'destroyed';
	          return resolve(null);
	        }

	        //
	        // Cursor was is open, need to fire GETMORE command
	        co(function*() {
	          // Create getMore additional options dictionary
	          var commandOptions = filterOptions(self.options, ['batchSize', 'maxTimeMS']);

	          // Execute the command
	          var r = yield self.db.command(Object.assign({
	            getMore: self.collection.namespace,
	            cursorId: self.cursorId,
	            connection: self.connection
	          }, commandOptions), {fullResult:true});

	          // Get the connection identifier
	          self.connection = r.connection;
	          r = r.result;

	          // Add the documents to the end
	          self.documents = self.documents.concat(r.cursor.nextBatch);
	          self.cursorId = r.cursor.id;
	          // Return the first document
	          var doc = self.documents.shift();
	          // We have no results
	          if(doc == undefined) {
	            self.state = 'destroyed';
	            return resolve(null);
	          }

	          // Return the document
	          resolve(doc);
	        }).catch(reject);
	      }
	    });
	  }

	  /**
	   * Get all documents in the cursor.
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  toArray() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      co(function*() {
	        var docs = [];

	        // Execute the find command
	        var r = yield self.db.command(self.cmd, {fullResult:true});

	        // Get the connection identifier
	        var connection = r.connection;
	        r = r.result;

	        // Get the documents, server format or API format
	        docs = docs.concat(r.cursor.firstBatch);
	        var cursorId = r.cursor.id;
	        // No more documents
	        if(cursorId.isZero()) return resolve(docs);

	        // Execute getMore's until we are done
	        while(true) {
	          // Create getMore additional options dictionary
	          var commandOptions = filterOptions(self.options, ['batchSize', 'maxTimeMS']);

	          // Execute the command
	          var r1 = yield self.db.command(Object.assign({
	            getMore: self.collection.namespace,
	            cursorId: cursorId.toJSON(),
	            connection: connection
	          }, commandOptions), {fullResult:true});

	          // Get the connection identifier
	          var connection = r1.connection;
	          r1 = r1.result;

	          // Get the documents, server format or API format
	          docs = docs.concat(r1.cursor.nextBatch);
	          var cursorId = r1.cursor.id;

	          // Get the documents
	          if(cursorId.isZero()) break;
	        }

	        // Return the document
	        resolve(docs);
	      }).catch(reject);
	    });
	  }

	  /**
	   * Destroy the cursor.
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  destroy() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      if(self.cursorId == null) return resolve();

	      //
	      // Cursor is open, need to fire KILLCURSOR command
	      co(function*() {
	        var r = yield self.db.command({
	          killCursors: [self.cursorId]
	        });

	        resolve();
	      }).catch(reject);
	    });
	  }
	}

	var filterOptions = function(options, fields) {
	  var object = {};

	  for(var i = 0; i < fields.length; i++) {
	    if(options[fields[i]]) object[fields[i]] = options[fields[i]];
	  }

	  return object;
	}

	module.exports = CommandCursor;


/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var co = __webpack_require__(33),
	  nextTick = __webpack_require__(2).nextTick;

	class EventEmitter {
	  constructor() {
	    this._events = {};
	  }

	  //
	  // Stream implementation
	  //

	  /**
	   *
	   */
	  emit(event, obj) {
	    var args = Array.prototype.slice.call(arguments, 1);

	    if(this._events[event]) {
	      for(var i = 0; i < this._events[event].length; i++) {
	        this._events[event][i].apply(this._events[event][i], args);
	      }
	    }
	  }

	  /**
	   *
	   */
	  on(event, callback) {
	    var self = this;

	    if(!this._events[event]) {
	      this._events[event] = [];
	    }

	    // Push the callback to the list of events
	    this._events[event].push(callback);

	    // We are done
	    if(event == 'data' && this._events[event].length == 1) {
	      // Stream all the data
	      var _read  = function() {
	        co(function*() {
	          // Get a document
	          var doc = yield self.next();
	          // If we have no document
	          if(!doc) {
	            return self.emit('end');
	          }

	          // We have a document
	          if(doc) {
	            self.emit('data', doc);
	          }

	          // Schedule another tick
	          nextTick(_read);
	        }).catch(function(err) {
	          self.emit('error', err);
	        });
	      }

	      nextTick(_read);
	    }
	  }
	}

	module.exports = EventEmitter;


/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var Promise = __webpack_require__(2).Promise,
	  EventEmitter = __webpack_require__(39),
	  co = __webpack_require__(33);

	// Contains the global liveQuery id used to associate queries
	var liveQueryId = 0;

	class Cursor extends EventEmitter {
	  constructor(db, collection, query) {
	    super();
	    this.db = db;
	    this.collection = collection;
	    this.query = query;

	    // State of the cursor
	    this.state = 'init';
	    this.documents = [];
	    this.cursorId = null;
	    // Currently selected document
	    this.document = null;
	    // The options
	    this.options = {};
	  }

	  get liveQueryId() {
	    return this.options.liveQueryId;
	  }

	  //
	  // Properties implementation
	  //
	  setReadPreference(mode, tags) {
	    this.options.readPreference = { mode: mode, tags: tags };
	    return this;
	  }

	  projection(value) {
	    this.options.projection = value;
	    return this;
	  }

	  comment(value) {
	    this.options.comment = value;
	    return this;
	  }

	  hint(value) {
	    this.options.hint = value;
	    return this;
	  }

	  maxTimeMS(value) {
	    this.options.maxTimeMS = value;
	    return this;
	  }

	  sort(value) {
	    this.options.sort = value;
	    return this;
	  }

	  limit(value) {
	    this.options.limit = value;
	    return this;
	  }

	  skip(value) {
	    this.options.skip = value;
	    return this;
	  }

	  batchSize(value) {
	    this.options.batchSize = value;
	    return this;
	  }

	  noCursorTimeout() {
	    this.options.noCursorTimeout = true;
	    return this;
	  }

	  /**
	   * Return count of documents
	   *
	   * @method
	   * @return {Cursor} returns Cursor
	   */
	  liveQuery() {
	    // Set the listen flag on the query
	    this.options.liveQuery = true;
	    this.options.liveQueryId = liveQueryId++;
	    // Return the cursor
	    return this;
	  }

	  /**
	   * Set up a tailable cursor
	   *
	   * @method
	   * @param {object} doc Document to insert.
	   * @param {object} [options=null] Optional settings.
	   * @param {boolean} [options.oplogReplay=false] Specify that we wish to use the oplogReply flag.
	   * @param {boolean} [options.awaitData=true] Specify that we wish to use the oplogReply flag.
	   */
	  tailable(options) {
	    this.options = Object.assign(this.options, {tailable:true, awaitData:true}, options || {});
	    return this;
	  }

	  //
	  // Function implementations
	  //

	  /**
	   * Return count of documents
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  count() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      co(function*() {
	        var r = yield self.db.command(Object.assign({
	          count: self.collection.namespace,
	          query: self.query
	        }), self.options);
	      });
	    });
	  }

	  /**
	   * Check if cursor contains more documents
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  hasNext() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      co(function*() {
	        if(self.document) return resolve(true);
	        self.document = yield self.next();
	        if(self.document == null) return resolve(false);
	        resolve(true);
	      }).catch(reject);
	    });
	  }

	  /**
	   * Get the next document available in the cursor
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  next() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      // User called hasNext, return the existing document first
	      if(self.state == 'destroyed') return reject(new Error('cursor exhausted or destroyed'));
	      if(self.document) {
	        var doc = self.document;
	        self.document = null;
	        return resolve(doc);
	      }

	      // We have documents left, resolve the next
	      if(self.documents.length > 0) {
	        return resolve(self.documents.shift());
	      } else if(self.documents.length == 0
	        && self.state == 'init') {

	        //
	        // Cursor was just opened, need to fire FIND command
	        co(function*() {
	          var commandOptions = filterOptions(self.options, ['readPreference', 'sort', 'projection'
	            , 'hint', 'skip', 'limit', 'batchSize', 'singleBatch', 'comment', 'maxScan', 'maxTimeMS'
	            , 'readConcern', 'max', 'min', 'returnKey', 'showRecordId', 'snapshot', 'tailable'
	            , 'oplogReply', 'noCursorTimeout', 'awaitData', 'allowPartialResults', "liveQuery", "liveQueryId"]);

	          // Execute the find command
	          var r = yield self.db.command(Object.assign({
	            find: self.collection.namespace,
	            filter: self.query
	          }, commandOptions), {fullResult:true});

	          // Get the connection identifier
	          self.connection = r.connection;
	          r = r.result;

	          // Add the documents to the end
	          self.documents = self.documents.concat(r.cursor.firstBatch);
	          self.cursorId = r.cursor.id;

	          // Are we listening
	          if(self.options.liveQuery && self.options.liveQueryId != null) {
	            self.db.store.liveQuery(self);
	          }

	          // Return the first document
	          var doc = self.documents.shift();
	          // We have no results
	          if(doc === undefined) {
	            self.state = 'destroyed';
	            return resolve(null);
	          }

	          // Set the state to open
	          self.state = 'open';
	          // Return the document
	          resolve(doc);
	        }).catch(reject);
	      } else if(self.documents.length == 0
	        && self.state == 'open' && self.cursorId.isZero()) {

	        //
	        // Cursor is dead
	        self.state = 'destroyed';
	        resolve(null);
	      } else if(self.documents.length == 0
	        && self.state == 'open') {

	        // Cursor id === 0 and no documents left === exhausted cursor.
	        if(self.cursorId.isZero()) {
	          self.state = 'destroyed';
	          return resolve(null);
	        }

	        //
	        // Cursor was is open, need to fire GETMORE command
	        co(function*() {
	          // Create getMore additional options dictionary
	          var commandOptions = filterOptions(self.options, ['batchSize', 'maxTimeMS']);

	          // Execute the command
	          var r = yield self.db.command(Object.assign({
	            getMore: self.collection.namespace,
	            cursorId: self.cursorId,
	            connection: self.connection
	          }, commandOptions), {fullResult:true});

	          // Get the connection identifier
	          self.connection = r.connection;
	          r = r.result;

	          // Add the documents to the end
	          self.documents = self.documents.concat(r.cursor.nextBatch);
	          self.cursorId = r.cursor.id;
	          // Return the first document
	          var doc = self.documents.shift();
	          // We have no results
	          if(doc == undefined) {
	            self.state = 'destroyed';
	            return resolve(null);
	          }

	          // Return the document
	          resolve(doc);
	        }).catch(reject);
	      }
	    });
	  }

	  /**
	   * Get all documents in the cursor.
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  toArray() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      co(function*() {
	        var docs = [];

	        // Filter out all command options
	        var commandOptions = filterOptions(self.options, ['readPreference', 'sort', 'projection'
	          , 'hint', 'skip', 'limit', 'batchSize', 'singleBatch', 'comment', 'maxScan', 'maxTimeMS'
	          , 'readConcern', 'max', 'min', 'returnKey', 'showRecordId', 'snapshot', 'tailable'
	          , 'oplogReply', 'noCursorTimeout', 'awaitData', 'allowPartialResults', 'liveQuery', "liveQueryId"]);

	        // Execute the find command
	        var r = yield self.db.command(Object.assign({
	          find: self.collection.namespace,
	          filter: self.query
	        }, commandOptions), {fullResult:true});

	        // Get the connection identifier
	        var connection = r.connection;
	        r = r.result;

	        // Are we listening
	        if(self.options.liveQuery && self.options.liveQueryId != null) {
	          self.db.store.liveQuery(self);
	        }

	        // Get the documents, server format or API format
	        docs = docs.concat(r.cursor.firstBatch);
	        var cursorId = r.cursor.id;
	        // No more documents
	        if(cursorId.isZero()) return resolve(docs);

	        // Execute getMore's until we are done
	        while(true) {
	          // Create getMore additional options dictionary
	          var commandOptions = {};
	          if(self.options.batchSize) commandOptions.batchSize = self.options.batchSize;
	          if(self.options.maxTimeMS) commandOptions.maxTimeMS = self.options.maxAwaitTimeMS;

	          // Execute the getMore command
	          var r1 = yield self.db.command(Object.assign({
	            getMore: self.collection.namespace,
	            cursorId: cursorId.toJSON(),
	            connection: connection
	          }, commandOptions), {fullResult:true});

	          // Get the connection identifier
	          var connection = r1.connection;
	          r1 = r1.result;

	          // Get the documents, server format or API format
	          docs = docs.concat(r1.cursor.nextBatch);
	          var cursorId = r1.cursor.id;

	          // Get the documents
	          if(cursorId.isZero()) break;
	        }

	        // Return the document
	        resolve(docs);
	      }).catch(reject);
	    });
	  }

	  /**
	   * Destroy the cursor.
	   *
	   * @method
	   * @return {Promise} returns Promise
	   */
	  destroy() {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      if(self.cursorId == null) return resolve();

	      //
	      // Cursor is open, need to fire KILLCURSOR command
	      co(function*() {
	        var r = yield self.db.command({
	          killCursors: [self.cursorId]
	        });

	        resolve();
	      }).catch(reject);
	    });
	  }
	}

	var filterOptions = function(options, fields) {
	  var object = {};

	  for(var i = 0; i < fields.length; i++) {
	    if(options[fields[i]] != null) object[fields[i]] = options[fields[i]];
	  }

	  return object;
	}

	module.exports = Cursor;


/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	"use strict"

	var Promise = __webpack_require__(2).Promise,
	  EventEmitter = __webpack_require__(39);

	class Connection extends EventEmitter {
	  constructor(socket) {
	    super();
	    var self = this;
	    this.socket = socket;

	    self.socket.on('connect', function(s) {
	      self.emit('connect');
	    });

	    self.socket.on('connect_error', function(err) {
	      self.emit('error', err);
	    });
	  }

	  onChannel(channel, callback) {
	    this.socket.on(channel, callback);
	  }

	  write(channel, obj) {
	    this.socket.emit(channel, obj);
	  }
	}

	class SocketIOTransport {
	  constructor(ioClientConnect, options) {
	    this.ioClientConnect = ioClientConnect;
	    this.options = options || {};
	    this.socket = null;
	  }

	  connect(url, options) {
	    var self = this;

	    return new Promise(function(resolve, reject) {
	      try {
	        // Create connection
	        self.socket = self.ioClientConnect(url);
	        // Return the connection wrapper (keep unified API across transports)
	        resolve(new Connection(self.socket));
	      } catch(err) {
	        reject(err);
	      }
	    });
	  }

	  on() {
	  }

	  emit() {
	  }
	}

	module.exports = SocketIOTransport;


/***/ }
/******/ ]);