"use strict";
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
		
		/*args.body.chat.:
				id
				first_name
				last_name
		args.body.text
		*/

		if (args.body.event == 'register') {
			
			Homey.manager('settings').set('chat_id', args.body.chat);
			Homey.log('chat_id registered: ' + args.body.chat);
			self.registerWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET);
			
		}else if (args.body.event == 'unregister') {
			
			Homey.manager('settings').set('chat_id', '');
			Homey.log('chat_id unregistered');
			self.registerWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET);
				
		} else {
		
			// Trigger event
			Homey.manager('flow').trigger('event', {
				data1: args.body.query || ''
			}, {
				event: args.body.event
			});
			
		}
		
	}
};