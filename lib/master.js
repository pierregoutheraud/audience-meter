var cluster = require('cluster'),
    log = require('./logger').log;

exports.Master = Master;

function Master(options)
{

  if (!(this instanceof Master)) return new Master(options);

  var _this = this;

  this.lives = options.lives;

  if (!options.workers) {
    options.workers = require('os').cpus().length;
  }

  var eachWorker = function(callback) {
    for (var id in cluster.workers) {
      callback(cluster.workers[id]);
    }
  };

  cluster.on('online', function(worker)
  {
    worker.on('message', function(msg, socket)
    {
      switch (msg.cmd)
      {
        case 'join':
          _this.lives.join(msg.name, msg.res, msg.params);
          break;

        case 'leave':
          _this.lives.leave(msg.name, msg.res, msg.params);
          break;

        case 'exclude':
          eachWorker(function(otherWorker) {
            if (worker !== otherWorker) {
                otherWorker.send(msg);
            }
          });
          // TODO: instruct other peers of same UDP multicast segment if cluster is activated
          break;
      }
    });
  });

  cluster.on('exit', function(worker, code, signal) {
      if (worker.suicide === true) {
          return;
      }
      log('warn', 'Respawn worker');
      cluster.fork();
  });

  for (var i = 0; i < options.workers; i++) {
      cluster.fork();
  }

  this.lives.on('notify', function(msg) {
    eachWorker(function(worker) {
      worker.send({cmd: 'notify', users: msg.users, msg: msg.msg});
    });
  });

  process.on('SIGTERM', function() {
    eachWorker(function(worker) {
      log('debug', 'Disconnect worker ' + worker.id);
      worker.kill();
    });
    process.exit();
  });
}