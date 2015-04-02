var util = require('util'),
    events = require('events');

util.inherits(Subscribers, events.EventEmitter);
exports.Subscribers = Subscribers;

function User(options){
  this.username = options.params.username;
  this.client = options.client;
}
User.prototype.notify = function(data){
  this.client.write(data);
};

function Subscribers()
{
    if (!(this instanceof Subscribers)) return new Subscribers();
    this.lastTotal = 0;
    this.setMaxListeners(0);
    this.users = []
}

Subscribers.prototype.createNotifyMessage = function(count, usernames)
{
  // Send JSON data
  var msg = 'data: {\n'
  msg += 'data: "count":' + count + '\n';
  if( usernames && usernames.length )
    msg += 'data: ,"usernames":["' + usernames.join('","') + '"]\n'
  msg += 'data: }\n\n'
  return msg;
};

Subscribers.prototype.notify = function(total, usernames)
{
    this.lastTotal = total;

    if (total === 0)
    {
        this.emit('empty');
    }
    else
    {
        this.emit('notify', this.createNotifyMessage(total, usernames));
    }
};

Subscribers.prototype.addClient = function(options)
{
    var self = this;

    var user = new User(options);
    this.users.push(user);

    user.client.write(this.createNotifyMessage(this.lastTotal + 1));

    function notify(e){
      user.notify.call(user,e);
    }

    this.on('notify',notify);

    user.client.on('close', function()
    {
        self.removeListener('notify',notify);
        self.emit('remove', this);
    });

    this.emit('add', user.client);

    return user;
};


function SubscribersGroup(options)
{
    if (!(this instanceof SubscribersGroup)) return new SubscribersGroup(options);

    this.groups = {};
    this.options =
    {
        log: function(severity, message) {console.log(message);}
    };

    for (var opt in options)
    {
        if (options.hasOwnProperty(opt))
        {
            this.options[opt] = options[opt];
        }
    }

    this.log = this.options.log;
}

module.exports.SubscribersGroup = SubscribersGroup;

SubscribersGroup.prototype.get = function(name, auto_create, params)
{
    var subscribers = this.groups[name];
    if (!subscribers && auto_create !== false)
    {
        this.log('debug', 'Create `' + name + '\' subscribers group');
        this.groups[name] = subscribers = new Subscribers();

        var self = this;
        subscribers.on('empty', function()
        {
            self.log('debug', 'Drop `' + name + '\' empty subscribers group');
            delete self.groups[name];
        });
        subscribers.on('add', function(client)
        {
            self.log('debug', 'Client subscribed to `' + name + '\'');
        });
        subscribers.on('remove', function(client)
        {
            self.log('debug', 'Client unsubscribed from `' + name + '\'');
        });
    }
    return subscribers;
};
