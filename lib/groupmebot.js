/*
 * groupmebot
 * https://github.com/billyvg/groupmebot
 *
 * Copyright (c) 2013 Billy Vong
 * Licensed under the MIT license.
 */

var util = require('util'),
    events = require('events'),
    WebSocketClient = require('websocket').client,
    _ = require('underscore'),
    request = require('request');

var API_V3_HOST = 'https://api.groupme.com/v3/',
    WEBSOCKET_HOST = 'wss://push.groupme.com/faye';

var Bot = function(options) {
  this.options = options;
  this.client = new WebSocketClient();
  this.initHandlers();
  this.clientId = '';
  this.socketId = 0;
  this.botId = {};
};

util.inherits(Bot, events.EventEmitter);

Bot.prototype._channels = {
    '/meta/handshake': 'handshakeHandle',
    '/meta/connect': 'connectHandle',
    '/meta/subscribe': 'subscribeHandle'
};

Bot.prototype.initHandlers = function() {
    var self = this;

    this.on('connect', function(connection) {
      connection.on('close', function() {
        self.emit('disconnect', connection);
        console.log('*** Disconnected');
      });

      connection.on('message', function(msg) {
        if (msg.type === 'utf8' && msg.utf8Data) {
          //console.log('*** Received: ' + msg.utf8Data);
          _.each(JSON.parse(msg.utf8Data), function(smsg) {
            if (smsg && typeof self._channels[smsg.channel] !== 'undefined' &&
                self[self._channels[smsg.channel]] !== 'undefined') {
              self[self._channels[smsg.channel]].call(self, smsg);
            }
          });
        }
      });
    });

    this.client.on('connectFailed', function(err) {
      self.emit('connectFailed', err);
      console.log('*** Connection Failed', err);
    });

    this.client.on('connect', function(connection) {
      self.connection = connection;
      console.log('connected');
      self.handshake();
    });
};

Bot.prototype.handshake = function() {
    var data = {
      channel: '/meta/handshake',
      version: '1.0',
      supportedConnectionTypes: ['websocket, callback-polling']
    };
    this.send([data]);
};
  
Bot.prototype.registerUser = function() {
    var data = {
      channel: '/meta/subscribe',
      clientId:  this.clientId,
      subscription: '/user/' + this.options.userId,
      ext: {
        access_token:  this.options.accessToken
      }
    };
    this.send([data]);
};
  
Bot.prototype.connectRemote = function(type) {
    var data = {
      channel: '/meta/connect',
      clientId:  this.clientId,
      subscription: '/user/' + this.options.userId,
      connectionType: type,
      advice: {
        timeout: 0
      }
    };
    this.send([data]);
};
  
Bot.prototype.subscribeUserStream = function() {
    var data = {
      channel: '/user/' + this.options.userId,
      data: {
        type: 'subscribe'
      },
      clientId: this.clientId,
      ext: {
        access_token: this.options.accessToken
      }
    };
    
    this._channels['/user/' + this.options.userId] = 'messageHandle';
    this.send([data]);
};
  
Bot.prototype.subscribeGroupStream = function(groups) {
    var data = [],
        self = this;
    _.each(groups, function(group) {
      data.push({
        channel: '/group/' + group,
        data: {
          type: 'subscribe'
        },
        clientId: self.clientId,
        ext: {
          access_token: self.options.accessToken
        }
      });
    });
    this.send(data);
};

Bot.prototype.handshakeHandle = function(msg) {
    this.clientId = msg.clientId;

    this.registerUser();
    this.connectRemote('websocket');
};

Bot.prototype.connectHandle = function(msg) {
  if (msg.successful) {
    this.subscribeUserStream();
  }
};

Bot.prototype.subscribeHandle = function(msg) {
  if (msg.successful) {
  }
};

Bot.prototype.messageHandle = function(msg) {
  var self = this,
      data,
      subject,
      text,
      split;

  if (msg.successful) {
    this.emit('connect');
    _.each(this.options.groups, function(group) {
      self.createBot(self.options.botName, group);
    });
    this.subscribeGroupStream(this.options.groups);
  }
  else {
    data = msg.data;
    if (data && data.type === 'line.create') {
      subject = data.subject;
      text = subject.text;
      split = text.split(' ');
      this.emit('message', subject);
    }
  }
};

Bot.prototype.send = function(data) {
    var self = this;
    _.each(data, function(d) {
      self.socketId++;
      d.id = self.socketId;
    });
    console.log('*** Sending: ', data);
    this.connection.send(JSON.stringify(data));
};

Bot.prototype.connect = function() {
    this.client.connect(WEBSOCKET_HOST);
};

Bot.prototype.message = function(text, group_id) {
  var self = this;

  if (typeof group_id === 'undefined') {
    _.each(this.options.groups, function(group) {
      if (typeof self.botId[group] !== 'undefined') {
        self.postMessage(text, self.botId[group]);
      }
    });
  }
  else {
    if (typeof self.botId[group_id] !== 'undefined') {
      self.postMessage(text, self.botId[group_id]);
    }
  }
};

Bot.prototype.postMessage = function(text, bot_id) {
  var msg = {
        bot_id: bot_id,
        text: text
      },
      url = API_V3_HOST + 'bots/post?token=' + this.options.accessToken,
      opts = {
        uri: url,
        method: 'POST',
        form: msg
      },
      req;

  console.log('*** Sending: ', text);
  req = request(opts, function(e, r, body) { });
};


Bot.prototype.createBot = function(name, group_id) {
  var msg = {
        'bot[name]': name,
        'bot[group_id]': group_id
      },
      url = API_V3_HOST + 'bots?token=' + this.options.accessToken,
      opts = {
        uri: url,
        method: 'POST',
        form: msg
      },
      req;

  req = request(opts, function(e, r, body) {
    var resp;
    if (body.meta && body.meta.code === 201) {
      resp = JSON.parse(body.response);
      self.botId[group_id] = resp.bot.bot_id;
      this.emit('botCreated', {
        name: name,
        groupId: group_id,
        botId: resp.bot.bot_id
      });
    }
  });
};

exports.Bot = Bot;
