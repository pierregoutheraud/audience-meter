var util = require('util'),
    events = require('events');

function User(options){
  this.res = options.res;
}
User.prototype.notify = function(data){
  this.res.write(data);
};

util.inherits(Live, events.EventEmitter);
function Live(options){
  _this = this;
  this.setMaxListeners(0);
  this.name = options.name;
  this.users = {
    added: [],
    removed: [],
    list: []
  }

  this.on('add', function(client)
  {
      // _this.log('debug', 'Client subscribed to `' + name + '\'');
  });

  // this.on('empty', function()
  // {
  //     _this.log('debug', 'Drop `' + name + '\' empty live group');
  //     // delete _this.groups[name];
  // });

  // this.on('remove', function(client)
  // {
  //     _this.log('debug', 'Client unsubscribed from `' + name + '\'');
  // });
}

Live.prototype.notify = function()
{
  if (this.audience === 0){
    this.emit('empty');
  } else {
    this.emit('notify', this.createNotifyMessage());
  }
};

Live.prototype.audience = function(){
  return this.users.list.length;
}

Live.prototype.createNotifyMessage = function()
{
  // Send JSON data through SSE
  var msg = 'data: {\n'
  msg += 'data: "audience":' + this.audience + '\n';
  if( this.users.list && this.users.list.length )
    msg += 'data: ,"users":["' + this.users.list.join('","') + '"]\n'
  msg += 'data: }\n\n'
  return msg;
};

Live.prototype.addUser = function(options)
{
    var _this = this;
    var user = new User(options);
    this.users.list.push(user);

    // function notifyUser(){
    //   user.notify.call(user);
    // }

    // On live notify, each users get notified
    this.on('notify', user.notify);

    // user.res.write(this.createNotifyMessage(this.lastTotal + 1));
    // function notify(e){
    //   user.notify.call(user,e);
    // }
    // this.on('notify',notify);
    // user.client.on('close', function()
    // {
    //     _this.removeListener('notify',notify);
    //     _this.emit('remove', this);
    // });
    // this.emit('add', user.client);
    return user;
};

function Lives(options)
{
  var _this = this;
  this.list = [];

  this.options = _.extend(options, {
    notify_delta_ratio: 0.1,
    notify_min_delay: 2,
    notify_max_delay: 25,
    namespace_clean_delay: 60,
    log: function(severity, message) {
      console.log(message);
    }
  });

  setInterval(function(){
    _this.notifyAll();
  }, this.options.notify_min_delay * 1000);
}
Lives.prototype.get = function(name, auto_create)
{
  var live = null,
      _this = this;

  for(var i=0,l=this.list.length;i<l;i++) {
    if(this.list[i].name === name){
      live = this.list[i];
      break;
    }
  }

  // Si le live n'existe pas on le cree
  if (!live && auto_create !== false)
  {
    // this.log('debug', 'Create `' + name + '\' subscribers group');
    live = new Live({
      name: name
    });
    this.list.push(live);
  } else { // Si le live existe, on le retire de la "queue" de clean
    clearTimeout(live.garbageTimer);
    delete live.garbageTimer;
  }

  return live;
};

Lives.prototype.clean = function(live)
{
  var _this = this;
  if (live.audience === 0 && !live.garbageTimer)
  {
    // this.log('debug', 'Schedule delete of `' + live.name + '\' live');
    live.garbageTimer = setTimeout(function() {
        // _this.log('debug', 'Delete `' + live.name + '\' live');
        // delete _this.lives[ _this.lives.indexOf(live) ];
        _this.list.splice(_this.list.indexOf(live),1); // Delete from list of lives
    }, this.options.namespace_clean_delay * 1000);
  }
};

Lives.prototype.

Lives.prototype.notifyAll = function()
{
  console.log('Lives notifyAll')

    for(var i=0,l=this.list.length;i<l;i++) {

      var live = this.list[i];
      if (live.audience === 0) {
        this.clean(live);
        continue;
      }

      /*
      if (Math.round(new Date().getTime() / 1000) - namespace.last.timestamp < this.options.notify_max_delay) {
        minDelta = Math.max(Math.floor(namespace.last.members * this.options.notify_delta_ratio), 1);
        if (Math.abs(namespace.last.members - namespace.members) < minDelta) {
          // Only notify if total members significantly changed since the last notice
          continue;
        }
      }
      namespace.last = {
        members: namespace.members,
        timestamp: Math.round(new Date().getTime() / 1000)
      };
      */

      this.log('debug', 'Notify `' + namespace.name + '\' namespace with ' + namespace.members + ' members');

      // var usernames = namespace.users.list.slice(); // Copy of array
      // namespace.users.added.length = 0;
      // namespace.users.removed.length = 0;

      // this.emit('notify', {
      //   namespace: namespace,
      //   usernames: usernames
      // });
    }
};


// module.exports.Live = Live;
module.exports.Lives = Lives;
