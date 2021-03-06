/**
 * redis-connection-pool.js
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version can be found here:
 *
 *   https://github.com/silverbucket/node-redis-connection-pool
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

var redis = require('redis');
var Q = require('q');
var Pool = require('generic-pool').Pool;

/**
 * Function: RedisConnectionPool
 *
 * A high-level redis management object. It manages a number of connections in
 * a pool, using them as needed and keeping all aspects of releasing active
 * connections internal to the object, so the user does not need to worry about
 * forgotten connections leaking memory and building up over time.
 *
 * Parameters:
 *
 *   uid - (string) - Unique identifer to retreive an existing instance from
 *                    elsewhere in an application. If left undefined, one will
 *                    be generate automatically and avaialble via the `UID`
 *                    property of the returned object.
 *
 *   cfg - (object) - A series of configuration parameters to be optionally
 *                    passed in and used during initialization of the object.
 *
 *
 *   cfg.HOST - (string) - Redis host (default: "127.0.0.1")
 *
 *   cfg.PORT - (number) - Redis port (default: 6379)
 *
 *   cfg.MAX_CLIENTS - (number) - Max clients alive in the connection pool at
 *                                once. (default: 30)
 *
 *   cfg.PERFORM_CHECKS - (boolean) - Perform a series of redis checks,
 *                                    currently this checks to to see if
 *                                    blocking push/pops can be used.
 *                                    (default: false)
 *
 * Returns:
 *
 *   A RedisConnectionPool object
 */
function RedisConnectionPool(uid, cfg) {
  this.UID = (typeof uid ==='string') ? uid : this.UID + Math.floor((Math.random() * 99999) + 10000);
  this.DEBUG = (typeof cfg.DEBUG === 'boolean') ? cfg.DEBUG : this.DEBUG;
  this.HOST = (typeof cfg.HOST === 'string') ? cfg.HOST : this.HOST;
  this.PORT = (typeof cfg.PORT === 'number') ? cfg.PORT : this.PORT;
  this.MAX_CLIENTS = (typeof cfg.MAX_CLIENTS === 'number') ? cfg.MAX_CLIENTS : this.MAX_CLIENTS;
  this.PERFORM_CHECKS = (typeof cfg.PERFORM_CHECKS === 'boolean') ? cfg.PERFORM_CHECKS : this.PERFORM_CHECKS;
  var self = this;

  var i = 0;
  this.pool = Pool({
    name: self.UID,
    create: function (callback) {
      var client = redis.createClient(self.PORT, self.HOST);
      client.__name = "client"+i;
      i = i + 1;

      client.on('error', function (err) {
        console.log('ERROR: '+err);
      });

      client.on('ready', function () {
        callback(null, client);
      });
    },
    destroy: function (client) {
      return client.quit();
    },
    max: self.MAX_CLIENTS,
    log: this.DEBUG
  });

  if (self.DEBUG) {
    setTimeout(function poolStats() {
      // periodically report pool statistics
      console.log('REDIS POOL: [size: '+pool.getPoolSize()+' avail:'+pool.availableObjectsCount()+' waiting:'+pool.waitingClientsCount()+']');
      setTimeout(poolStats, 300000);
    }, 300000);
  }

  redisCheck.apply(this, []);
  return this;
}
RedisConnectionPool.prototype = {
  UID: 'redis-connection-pool-',
  DEBUG: false,
  HOST: '127.0.0.1',
  PORT: 6379,
  MAX_CLIENTS: 30,
  BLOCKING_SUPPORT: true,
  PERFORM_CHECKS: false,
  VERSION_ARRAY: undefined,
  VERSION_STRING: undefined
};

/**
 * Function: on
 *
 * listen for redis events
 *
 * Parameters:
 *
 *   type - (string) - Type of event to listen for.
 *   cb   - (function) - Callback function when the event is triggered.
 *
 */
RedisConnectionPool.prototype.on = function(type, cb) {
  client = redis.createClient();
  client.on(type, cb);
};

/**
 * Function: expire
 *
 * Execute a redis EXPIRE command
 *
 * Parameters:
 *
 *   key   - (string) - A key to assign value to
 *   value - (number) - TTL in seconds
 *
 */
RedisConnectionPool.prototype.expire = function (key, data) {
  redisSingle.apply(this, ['expire', key, data]);
};

/**
 * Function: set
 *
 * Execute a redis SET command
 *
 * Parameters:
 *
 *   key  - (string) - A key to assign value to
 *   data - (string) - Value to assign to key
 *   cb   - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.set = function (key, data, cb) {
  _setFuncs.apply(this, ['set', key, data, cb]);
};

/**
 * Function: get
 *
 * Execute a redis GET command
 *
 * Parameters:
 *
 *   key  - (string) - The key of the value you wish to get
 *   cb   - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.get = function (key, cb) {
  _getFuncs.apply(this, ['get', key, cb]);
};

/**
 * Function: del
 *
 * Execute a redis DEL command
 *
 * Parameters:
 *
 *   key  - (string) - The key of the value you wish to delete
 *
 */
RedisConnectionPool.prototype.del = function (key) {
  redisSingle.apply(this, ['del', key]);
};

/**
 * Function: hset
 *
 * Execute a redis HSET command
 *
 * Parameters:
 *
 *   key   - (string) - A key to assign the hash to
 *   field - (string) - Name of the field to set
 *   data  - (string) - Value to assign to hash
 *   cb    - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.hset = function (key, field, data, cb) {
  _setFuncs.apply(this, ['hset', key, field, data, cb]);
};

/**
 * Function: hget
 *
 * Execute a redis HGET command
 *
 * Parameters:
 *
 *   key   - (string) - The key of the hash you wish to get
 *   field - (string) - The field name to retrieve
 *   cb    - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.hget = function (key, field, cb) {
  _getFuncs.apply(this, ['hget', key, field, cb]);
};

/**
 * Function: hgetall
 *
 * Execute a redis HGETALL command
 *
 * Parameters:
 *
 *   key   - (string) - The key of the hash you wish to get
 *   cb    - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.hgetall = function (key, cb) {
  _getFuncs.apply(this, ['hgetall', key, cb]);
};

/**
 * Function: rpush
 *
 * Execute a redis RPUSH command
 *
 * Parameters:
 *
 *   key   - (string) - The list key
 *   data  - (string) - Value to assign to the list
 *   cb    - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.rpush = function (key, data, cb) {
  _setFuncs.apply(this, ['rpush', key, data, cb]);
};

/**
 * Function: lpush
 *
 * Execute a redis LPUSH command
 *
 * Parameters:
 *
 *   key   - (string) - The list key
 *   data  - (string) - Value to assign to the list
 *   cb    - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.lpush = function (key, data, cb) {
  _setFuncs.apply(this, ['lpush', key, data, cb]);
};

/**
 * Function: blpop
 *
 * Execute a redis BLPOP command
 *
 * Parameters:
 *
 *   key   - (string) - The list key
 *   cb    - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.blpop = function (key, cb) {
  _getFuncs.apply(this, ['blpop', key, cb]);
};

/**
 * Function: brpop
 *
 * Execute a redis BRPOP command
 *
 * Parameters:
 *
 *   key   - (string) - The list key
 *   cb    - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.brpop = function (key, cb) {
  _getFuncs.apply(this, ['brpop', key, cb]);
};

/**
 * Function: clean
 *
 * Clean the redis key namespace
 *
 * Parameters:
 *
 *   key  - (string) - The key of the value you wish to clear (can use wildcard *)
 *   cb   - (function) - Callback to be executed on completion
 *
 */
RedisConnectionPool.prototype.clean = function (key, cb) {
  console.log('redis-connection-pool: clearing redis key ' + key);
  var client = redis.createClient();
  var self = this;

  client.keys(key, function (err, keys) {
    client.quit();
    //console.log('redis-connection-pool: keys ', keys);
    if ((keys) && (keys.forEach)) {
      keys.forEach(function (name, pos) {
        console.log('redis-connection-pool: deleting name ' + name);
        self.del(name);
      });
    } else {
      console.log('ERROR redis-connection-pool: couldnt get keys list on key \''+key+'\': ', keys);
    }
    if (err) {
      console.log('ERROR redis-connection-pool: failed clearing redis queue. '+err);
    }
    cb();
  });
};

/**
 * Function: check
 *
 * Performs a check on redis version and sets internal config based on support.
 *
 * This function is for compatibility checking, you don't normally need this.
 *
 * Returns:
 *
 *   promise which, on completion will return a version number as a string.
 */
RedisConnectionPool.prototype.check = function () {
  return redisCheck.apply(this, []);
};




function redisSingle (funcName, key, val) {
  var pool = this.pool;
  pool.acquire(function (err, client) {
    if (val) {
      client[funcName](key, val, function () {
        pool.release(client);
      });
    } else {
      client[funcName](key, function () {
        pool.release(client);
      });
    }
  });
}

function _setFuncs(funcName, key, field, data, cb) {
  var pool = this.pool;

  if (typeof cb === 'undefined') {
    cb = data;
    data = field;
    field = null;
  }
  pool.acquire(function (err, client) {
    // console.log('redis-connection-pool: ' + funcName + ' ID: ' + client.__name +
    //             ' to key ' + key + ' field: '+ field + ' (func:'+typeof cb+') DATA: ', data);
    if (funcName === 'hset') {
      client[funcName](key, field, data, function (err, reply) {
        pool.release(client);
        if (err) {
          console.log("ERROR redis-connection-pool: " + funcName + ": " + err);
        }
        if (typeof cb === 'function') {
          cb(err, reply);
        }
      });
    } else if (funcName === 'set') {
      //console.log('--- key ('+typeof key+'): ' + key + ' DATA ('+typeof data+'): ', data);
      client[funcName](key, data, function (err, reply) {
        pool.release(client);
        if (err) {
            console.log("ERROR redis-connection-pool: " + funcName + ": " + err);
        }
        if (typeof cb === 'function') {
          cb(err, reply);
        }
      });
    } else {
      // if ((typeof data === 'undefined') || (typeof data === 'function')) {
      //   cb = data;
      //   data = field;
      //   field = null;
      // }
      //console.log('--- field ('+typeof field+'): '+field+' DATA ('+typeof data+'): ', data);
      client[funcName](key, data, function (err, reply) {
        pool.release(client);
        if (err) {
            console.log("ERROR redis-connection-pool: " + err);
        }
        if (typeof cb === 'function') {
          cb(err, reply);
        }
      });
    }
  });
}


function _getFuncs(funcName, key, field, cb) {
  var pool = this.pool;
  var self = this;
  if ((typeof field === 'function') && (typeof cb === 'undefined')) {
    cb = field;
    field = null;
  }
  //console.log('redis-connection-pool: getFuncs('+funcName+', '+key+', '+field+', '+typeof cb);
  pool.acquire(function (err, client) {

    if ((funcName === 'get') || (funcName === 'hgetall')) {
      redisGet.apply(self, [funcName, client, key, cb]);
    } else if (funcName === 'blpop') {
      redisBlockingGet.apply(self, ['blpop', client, key, cb]);
    } else if (funcName === 'brpop') {
      redisBlockingGet.apply(self, ['brpop', client, key, cb]);
    } else if (funcName === 'hget') {
      redisHashGet.apply(self, [client, key, field, cb]);
    } else if (funcName === 'hgetall') {
      redisHashGet.apply(self, [client, key, null, cb]);
    }
  });
}

// works for get and hgetall
function redisGet(funcName, client, key, cb) {
  var pool = this.pool;
  //console.log('REDIS POOL: get ID: ' + client.__name + ' to key ' + key);
  var responded = false;
  client[funcName](key, function (err, replies) {
    responded = true;
    pool.release(client);
    if (err) {
      console.log('ERROR: redis error ('+funcName+' '+key+')', err);
      cb(err, null);
    } else {
      cb(err, replies);
    }
  });

  setTimeout(function() {
    if (!responded) {
      console.log('ERROR: redis.'+funcName+' never returned (5s), destroying connection. '+key);
      pool.destroy(client);
    }
  }, 5000);
}

function redisHashGet(client, key, field, cb) {
  var pool = this.pool;
  //console.log('REDIS POOL: get ID: ' + client.__name + ' to key ' + key + ' field:' + key);
  if (field) {
    client.hget(key, field, function (err, replies) {
      pool.release(client);
      if (err) {
        console.log('ERROR: redis error (hget '+key+')', err);
        cb(err, null);
      } else {
        cb(err, replies);
      }
    });
  } else {
    client.hgetall(key, function (err, replies) {
      pool.release(client);
      if (err) {
        console.log('ERROR: redis error (hget '+key+')', err);
        cb(err, null);
      } else {
        cb(err, replies);
      }
    });
  }
}

function redisBlockingGet(funcName, client, key, cb) {
  var pool = this.pool;
  //console.log(' [util] --- '+funcName+' ID: ' + client.__name + ' to key ' + key);
  var responded = false;
  client[funcName](key, 0, function (err, replies) {
    responded = true;
    pool.release(client);
    if (err) {
      console.log('ERROR redis-connection-pool: (' + funcName + ')', err);
      cb(err, null);
    } else if ((!replies) || (typeof replies[1] === 'undefined')) {
      console.log('ERROR redis-connection-pool: got a bad reply: ', replies);
      cb('got bad reply from redis', []);
    } else {
      //console.log(funcName + ' received: ', replies);
      cb(err, replies);
    }
  });

  // var minutes = 0;
  // setTimeout(function reportClient() {
  //   if (!responded) {
  //     minutes = minutes + 1;
  //     console.log(' [util] still waiting '+minutes+'m ['+funcName+':'+client.__name+' '+key+']');
  //     setTimeout(reportClient, 60000);
  //   }
  // }, 60000);
}

function redisCheck() {
  var q = Q.defer();
  var self = this;
  //console.log("redis-connection-pool: checking redis connection at " + self.HOST + ':' + self.PORT);
  var client = redis.createClient(self.PORT, self.HOST);
  try {
    client.on('error', function (err) {
      client.quit();
      q.reject(err);
    });
    client.on('ready', function () {
      //console.log('redis version: '+client.server_info.redis_version);
      self.VERSION_STRING = client.server_info.redis_version;
      self.VERSION_ARRAY = client.server_info.versions;
      if (self.VERSION_ARRAY[0] < 2) {
        self.BLOCKING_SUPPORT = false;
      }
      client.quit();
      q.resolve(self.VERSION_STRING);
    });
  } catch (e) {
    console.log('ERROR redis-connection-pool: cannot connect to redis, ' + e);
    q.reject('cannot connect to redis: ' + e);
    client.quit();
  }
  return q.promise;
}



var RedisConnectionPoolWrapper;
(function () {
  var redisConnectionPools = {};
  RedisConnectionPoolWrapper = function (uid, cfg) {
    if (typeof redisConnectionPools[uid] === 'object') {
      return redisConnectionPools[uid];
    } else {
      var redisConnectionPool = new RedisConnectionPool(uid, cfg);
      redisConnectionPools[redisConnectionPool.uid] = redisConnectionPool;
      return redisConnectionPool;
    }
  };
})();

module.exports = function (uid, cfg) {
  if (typeof uid === 'object') {
    cfg = uid;
    uid = undefined;
  } else if (typeof cfg === 'undefined') {
    cfg = {};
  }

  return RedisConnectionPoolWrapper(uid, cfg);
};