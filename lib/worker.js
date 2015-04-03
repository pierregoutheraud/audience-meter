var events = require('events'),
    url = require('url'),
    http = require('http'),
    merge = require('./utils').merge,
    Lives = require('./lives').Lives,
    log = require('./logger').log;

exports.Worker = Worker;

function Worker(options)
{
  var _this =  this;
  if (!(this instanceof Worker)) return new Worker(options);
  this.options = options = merge
  ({
      uuid: false,
      increment_delay: 0,
      max_conn_duration: 0
  }, options);

  this.lives = new Lives(this.options);

  this.clientRegistry = {};

  // process.on('message', function(msg)
  // {
  //     switch (msg.cmd)
  //     {
  //         case 'notify':
  //             _this.notify(msg.namespace, msg.usernames, msg.msg);
  //             break;
  //         case 'exclude':
  //             _this.exclude(msg.uuid, false);
  //             break;
  //     }
  // });

  var path2ns = /^\/([^\/]+)(?:\/([^\/]+))?$/,
      policyFile = '<?xml version="1.0"?>' +
                   '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">' +
                   '<cross-domain-policy>' +
                   '<site-control permitted-cross-domain-policies="master-only"/>' +
                   '<allow-access-from domain="*" secure="false"/>' +
                   '<allow-http-request-headers-from domain="*" headers="Accept"/>' +
                   '</cross-domain-policy>';

  var server = http.Server();
  server.listen((process.env.PORT || 9999), process.env.HOST);
  server.on('request', function(req, res)
  {

      var pathname = url.parse(req.url).pathname,
          pathInfo = null;

      // Get query params
      var params = url.parse(req.url, true).query

      if (typeof pathname != 'string')
      {
          // Go to catch all
      }
      else if (pathname == '/crossdomain.xml')
      {
          options.log('debug', 'Sending policy file');
          res.writeHead(200, {'Content-Type': 'application/xml'});
          return res.end(policyFile);
      }
      else if ((pathInfo = pathname.match(path2ns)))
      {
          var namespace = pathInfo[1],
              uuid = options.uuid ? pathInfo[2] : null;

          if (res.socket && req.headers.accept && req.headers.accept.indexOf('text/event-stream') != -1)
          {
              res.writeHead(200,
              {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Access-Control-Allow-Origin': '*',
                  'Connection': 'close'
              });

              req.connection.setNoDelay(true);

              if (req.headers['user-agent'] && req.headers['user-agent'].indexOf('MSIE') != -1)
              {
                  // Work around MSIE bug preventing Progress handler from behing thrown before first 2048 bytes
                  // See http://forums.adobe.com/message/478731
                  res.write(new Array(2048).join('\n'));
              }

              _this.join(namespace, res, uuid, params);

              if (options.max_conn_duration > 0)
              {
                  // Force end of the connection if maximum duration is reached
                  res.maxDurationTimeout = setTimeout(function() {res.end();}, options.max_conn_duration * 1000);
              }
              return;
          }
          else
          {
              _this.exclude(uuid);
          }
      }

      // TODO: reimplement subscriptions

      // Catch all
      res.writeHead(200,
      {
          'Content-Length': '0',
          'Connection': 'close'
      });
      res.end();
  });

  log('debug', 'Worker started');
}

Worker.prototype.exclude = function(uuid, broadcast)
{
    if (!uuid) return;
    var formerClient = this.clientRegistry[uuid];
    if (formerClient) formerClient.end('retry: -1\n\n');
    if (broadcast !== false)
    {
        process.send({cmd: 'exclude', uuid: uuid});
    }
};

Worker.prototype.notify = function(namespace, usernames, total)
{
    var subscribers = this.groups.get(namespace.name, false);
    if (subscribers) subscribers.notify(total, usernames);
};

Worker.prototype.join = function(namespace, res, uuid, params)
{
    var _this = this, user = null;

    // Increment namespace counter on master (after a configured delay to mitigate +/- flood)
    res.incrementTimeout = setTimeout(function()
    {

      user = _this.lives.get(namespace, true).addUser({
        res:res,
        params:params
      });

      delete res.incrementTimeout;

    }, this.options.increment_delay * 1000);

    // Decrement on exit
    res.socket.on('close', function()
    {
        // Notify about the decrement only if the increment happended
        if (!user || 'incrementTimeout' in res) {
          clearTimeout(res.incrementTimeout);
        }
        else {
          user.leave();
        }

        if (uuid && _this.clientRegistry[uuid] == user.res) {
          delete _this.clientRegistry[uuid];
        }

        if (user.res.hasOwnProperty('maxDurationTimeout')) {
          clearTimeout(user.res.maxDurationTimeout);
        }
    });

    // If uuid is provided, ensure only one res with same uuid is connected to this namespace
    // if (uuid)
    // {
    //     this.exclude(uuid);
    //     this.clientRegistry[uuid] = user.res;
    // }
};

Worker.prototype.subscribe = function(namespaces, client)
{
    if (!util.isArray(namespaces))
    {
        // array required
        return;
    }

    // Subscribe to a list of namespaces
    namespaces.forEach(function(namespace)
    {
        if (typeof namespace != 'string')
        {
            // array of string required
            return;
        }

        if (namespace)
        {
            this.groups.get(namespace).addClient({client:client});
        }
    });
};
