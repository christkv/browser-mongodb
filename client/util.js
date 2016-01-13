if(typeof window !== 'undefined') {
  var Promise = window.Promise || require('es6-promise').Promise;
} else if(typeof global !== 'undefined') {
  var Promise = global.Promise || require('es6-promise').Promise;
}

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

module.exports = {
  Promise: Promise,
  nextTick: nextTick
};
