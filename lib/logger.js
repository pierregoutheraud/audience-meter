var cluster = require('cluster');

function log(severity, message)
{
  if (severity === 'error')
  {
    console.error('[%s] [%s] %s', cluster.isMaster ? 'master' : 'child#' + process.pid, severity, message);
  }
  else if (global.options.debug)
  {
    console.log('[%s] [%s] %s', cluster.isMaster ? 'master' : 'child#' + process.pid, severity, message);
  }
}

module.exports.log = log;
