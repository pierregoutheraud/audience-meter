var util = require('util'),
    events = require('events'),
    _ = require('underscore'),
    log = require('./logger').log;

util.inherits(User, events.EventEmitter);
function User(options){
  this.username = options.params.username;
}

util.inherits(Live, events.EventEmitter);
function Live(options){

  _this = this;
  this.setMaxListeners(0);
  this.name = options.name;
  this.users = {
    added: [],
    removed: [],
    list: []
  };
  this.lastAudience = 0;

  // Empty added and removed users
  this.on('notify', function(){
    _this.users.added.length = 0;
    _this.users.removed.length = 0;
  });

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

Live.prototype.notify = function()
{
  // if (this.audience === 0){
  //   this.emit('empty');
  // } else {
  //   this.emit('notify', {msg:this.createNotifyMessage()});
  // }
};

Live.prototype.getAudience = function(){
  return this.users.list.length;
};
Live.prototype.getLastAudience = function(){
  return this.lastAudience;
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
  if( this.users.added && this.users.added.length ) {
    msg += 'data: ,"added":["' + this.users.added.join('","') + '"]\n';
  }
  if( this.users.removed && this.users.removed.length ) {
    msg += 'data: ,"removed":["' + this.users.removed.join('","') + '"]\n';
  }

  msg += 'data: }\n\n'
  return msg;
};

Live.prototype.hasUser = function(username) {
  var user = _.findWhere( this.users.list, {username:username} );
  return user ? true : false;
};

Live.prototype.removeUser = function(user) {
  log('debug', 'Remove user: "' + user.username + '"');
  var index = this.users.list.indexOf(user);
  if( index !== -1 ) {
    // user.removeAllListeners();
    this.users.removed.push(user.username);
    this.users.list.splice(index,1);
  }
}

Live.prototype.removeUserByName = function(username) {
  log('debug', 'Remove user: "' + username + '"');
  this.users.removed.push(username);
  var user = _.findWhere(this.users.list, {username:username});
  var index = _.indexOf(this.users.list,user);
  if( index !== -1 ) {
    this.users.list.splice(index,1);
  }
};

Live.prototype.addUser = function(options)
{
    var _this = this;
    var user = new User(options);

    if( !this.hasUser(user.username) ) {

      this.users.list.push(user);
      this.users.added.push(user.username);

      // On live notify, each users get notified
      // function notifyUser(e){ user.notify.call(user,e); }
      // this.on('notify', notifyUser);

      // user.on('leave', function(){
      //   // _this.removeListener('notify', notifyUser);
      //   _this.removeUser( this );
      // });

      log( 'debug', 'Add user: "' + user.username + '"' );

      this.emit('add', user);

      return user;

    }

    return null

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
  }, global.options.notify_min_delay * 1000);
}

Lives.prototype.join = function(name, res, params) {

  var live = this.get(name);
  var user = live.addUser({
    res:res,
    params:params
  });

};

Lives.prototype.leave = function(name, res, params) {
  this.get(name).removeUserByName(params.username);
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
  var live;

  for(var i=0,l=this.list.length;i<l;i++) {

    live = this.list[i];

    // if (live.audience === 0) {
    //   this.clean(live);
    //   continue;
    // }

    var audience = live.getAudience();

    if( audience === live.getLastAudience() ) {
      continue;
    } else {
      live.lastAudience = audience;
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

    log('debug', 'Notify live "' + live.name + '"');
    this.emit('notify', {users:live.getUsernames(), msg:live.createNotifyMessage()});
  }

};


// module.exports.Live = Live;
module.exports.Lives = Lives;
