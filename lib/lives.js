var util = require('util'),
    events = require('events'),
    _ = require('underscore'),
    log = require('./logger').log;

function User(options){
  this.username = options.params.username;
}

util.inherits(Live, events.EventEmitter);
function Live(options){

  _this = this;
  this.setMaxListeners(0);
  this.name = options.name;
  this.users = {
    list: [],
    joined: [],
    left: [],
    last: []
  };
  this.changed = false;

  // this.on('add', function(client)
  // {
      // _this.log('debug', 'Client subscribed to `' + name + '\'');
  // });

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

Live.prototype.notify = function() {
  this.changed = true;
}

Live.prototype.notified = function()
{
  this.users.last = this.getUsernames();
  this.changed = false;
};

Live.prototype.getAudience = function(){
  return this.users.list.length;
};

Live.prototype.getUsernamesString = function() {
  return _.map(this.users.list,function(u){return u.username;}).join(',');
};
Live.prototype.getUsernames = function() {
  return _.map(this.users.list,function(u){return u.username;});
};

Live.prototype.createNotifyMessage = function()
{
  // Send JSON data through SSE
  var usernames = this.getUsernames();
  var msg = 'data: {\n'
  msg += 'data: "audience":' + this.getAudience() + '\n';

  // if( this.users.list && this.users.list.length ) {
  //   msg += 'data: ,"users":["' + usernames.join('","') + '"]\n';
  // }
  if( this.users.joined && this.users.joined.length ) {
    msg += 'data: ,"joined":["' + this.users.joined.join('","') + '"]\n';
  }
  if( this.users.left && this.users.left.length ) {
    msg += 'data: ,"left":["' + this.users.left.join('","') + '"]\n';
  }

  msg += 'data: }\n\n'

  console.log(msg)

  return msg;
};

Live.prototype.getUser = function(username) {
  var user = _.findWhere( this.users.list, {username:username} );
  return user ? user : null;
};

Live.prototype.removeUser = function(user) {
  log('debug', 'Remove user: "' + user.username + '"');
  var index = this.users.list.indexOf(user);
  if( index !== -1 ) {
    // user.removeAllListeners();
    this.users.list.splice(index,1);
  }
}

Live.prototype.removeUserByName = function(username) {

  var user = _.findWhere(this.users.list, {username:username});

  // Remove from list
  var index = _.indexOf(this.users.list,user);
  if( index !== -1 ) {
    this.users.list.splice(index,1);
  }

  log('debug', 'Removed user: "' + username + '"');

};

Live.prototype.addUser = function(options)
{
    var _this = this,
        username = options.params.username,
        user = this.getUser(username);

    if( user ) {
      return user;
    } else {

      log( 'debug', 'Add user: "' + username + '"' );

      user = new User(options);
      this.users.list.push(user);

      this.emit('add', user);

      return user;

    }

};

util.inherits(Lives, events.EventEmitter);
function Lives(options)
{

  if (!(this instanceof Lives)) return new Lives(options);

  var _this = this;
  this.list = [];

  this.options = _.extend(options, {
    notify_delta_ratio: 0.1,
    notify_min_delay: 2,
    notify_max_delay: 25,
    namespace_clean_delay: 60
  });

  setInterval(function(){
    _this.notifyAll();
  }, global.options.notifyMinDelay * 1000);
}

Lives.prototype.join = function(name, res, params) {

  var live = this.get(name);
  live.addUser({
    res:res,
    params:params
  });
  live.notify();

};

Lives.prototype.leave = function(name, res, params) {
  var live = this.get(name);
  live.removeUserByName(params.username);
  live.notify();
};

Lives.prototype.get = function(name, auto_create)
{

  log('debug', 'get live "' + name + '"');

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
    log('debug', 'Create new live "' + name + '"');
    live = new Live({
      name: name,
      lives: _this
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
    log('debug', 'Schedule delete of `' + live.name + '\' live');
    live.garbageTimer = setTimeout(function() {
        log('debug', 'Delete `' + live.name + '\' live');
        // delete _this.lives[ _this.lives.indexOf(live) ];
        _this.list.splice(_this.list.indexOf(live),1); // Delete from list of lives
    }, global.options.namespace_clean_delay * 1000);
  }
};

Lives.prototype.notifyAll = function()
{

  log('debug', 'notifyAll');

  var live;

  for(var i=0,l=this.list.length;i<l;i++) {

    live = this.list[i];

    if( !live.changed ) {
      continue;
    }

    // If has changed but empty
    if( live.getAudience() === 0 ) {
      this.clean(live);
      continue;
    }

    var current = live.getUsernames();
    live.users.left = _.difference(live.users.last,current);
    live.users.joined = _.difference(current,live.users.last);

    this.emit('notify', {users:live.getUsernames(), msg:live.createNotifyMessage()});
    live.notified()

    log('debug', 'Notify live "' + live.name + '"');

  }

};


// module.exports.Live = Live;
module.exports.Lives = Lives;
