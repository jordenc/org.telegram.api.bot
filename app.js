"use strict";

var http = require('http.min');

var webhookID;
var device_id;
var chat_id;

var self = module.exports = {
	init: function () {

		device_id = Homey.manager('settings').get('device_id');

		if (device_id) {

			Homey.log ('We still remembered device_id: ' + device_id);

		} else {

			var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

			device_id = '';
		    for( var i=0; i < 10; i++ )
		        device_id += possible.charAt(Math.floor(Math.random() * possible.length));

			Homey.log('new device_id: ' + device_id);
			device_id = Homey.manager('settings').set('device_id', device_id);

		}
		
		chat_id = Homey.manager('settings').get('chat_id');
		
		if (chat_id) {

			Homey.log ('We still remembered chat_id: ' + chat_id);

		} else {
			
			Homey.log ('Not yet registered with chat_id');
			
		}	

		// On triggered flow
		Homey.manager('flow').on('trigger.event', function (callback, args, state) {

			// Check if event triggered is equal to event send in flow card
			callback( null, args.event === state.event );
		});

		// Register initial webhook
		if (Homey.env.CLIENT_ID && Homey.env.CLIENT_SECRET) {

			// Register webhook
			self.registerWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET);

		}

	},
	registerWebhook: function (id, secret, callback) {

		// Register webhook
		Homey.manager('cloud').registerWebhook(id, secret, {device_id: device_id, chat_id: chat_id}, self.incomingWebhook,
			function (err, result) {
				if (err || !result) {

					Homey.log('registering webhook failed');

					// Return failure
					if (callback)callback(true, null);
				}
				else {
					// Unregister old webhook
					if (webhookID && webhookID !== id) Homey.manager('cloud').unregisterWebhook(webhookID);

					Homey.log('registering webhook succeeded');

					// Return success
					if (callback)callback(null, true);
				}
			});

		// Store used webhook internally
		webhookID = id;
	},
	incomingWebhook: function (args) {

		Homey.log('incoming webhook: ' + JSON.stringify(args));

		if (args.body.message.text.substr(0,10) == '/register ') {
			
			chat_id = args.body.message.from.id;
			Homey.manager('settings').set('chat_id', chat_id);
			Homey.log('chat_id registered: ' + chat_id);
			self.registerWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET);
			
			sendchat (__("registered"));
			
		}else if (args.body.message.text.substr(0,12) == '/unregister ') {
			
			Homey.manager('settings').set('chat_id', '');
			sendchat (__("unregistered"));
			chat_id = '';
			Homey.log('chat_id unregistered');
			self.registerWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET);
			
		} else if (args.body.message.text == 'ping') {
			
			sendchat ('pong');
				
		} else {
		
			// Trigger event
			Homey.manager('flow').trigger('incomingmessage', {
				message: args.body.message.text || ''
			});
			
		}
		
	}
};

function sendchat (message, callback) {
	
	var bot_token = Homey.manager('settings').get('bot_token');
	
	if (bot_token == undefined) {
		Homey.log('No custombot set - using default bot');
		bot_token = Homey.env.BOT_TOKEN;
	}
	
	http('https://api.telegram.org/bot' + bot_token + '/sendMessage?chat_id=' + chat_id + '&text=' + message).then(function (result) {
	  	Homey.log('Code: ' + result.response.statusCode)
	  	Homey.log('Response: ' + result.data)
	  	
	  	if (result.response.statusCode == 200) callback (null, true); else callbcak (result.data, false);
	});

}

Homey.manager('flow').on('action.sendmessage', function (callback, args) {
	
	Homey.log('args='+JSON.stringify(args));
	sendchat (args.text, callback);
	
});