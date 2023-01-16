"use strict";

const Homey 		= require('homey');
const {PassThrough} = require('stream');

const fetch 		= require('node-fetch');
const FormData 		= require('form-data');
const CONTENT_TYPES = {
	png: 'image/png',
	jpg: 'image/jpeg',
	gif: 'image/gif'
};

let chat_ids 	=	[];

var last_msg_id;


class App extends Homey.App {

	async onInit() {

		let device_id = this.homey.settings.get('device_id');
		let bot_token = this.homey.env.BOT_TOKEN;

		chat_ids = this.homey.settings.get('chat_ids');

		var custom_bot = this.homey.settings.get('bot_token');

		console.log("custom_bot = " + typeof custom_bot + " / " + JSON.stringify(custom_bot));

		if (custom_bot !== null && custom_bot != "") {

			bot_token = custom_bot;

		}

		if (typeof chat_ids != "object") {
			console.log('Not yet registered with chat_ids');
			chat_ids = [];
		} else {
			console.log('We still remembered chat_ids: ' + JSON.stringify(chat_ids));
		}
		/*
		if (custom_bot_token) {
			
			bot_token = custom_bot_token;
			
		}
		*/

		if (device_id) {

			console.log('We still remembered device_id: ' + device_id);

		} else {

			var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

			device_id = '';
			for (var i = 0; i < 10; i++)
				device_id += possible.charAt(Math.floor(Math.random() * possible.length));

			console.log('new device_id: ' + device_id);
			this.homey.settings.set('device_id', device_id);

		}

		this.sendMessage = this.homey.flow.getActionCard('sendmessage')
			.registerRunListener(async (args) => {

				console.log('[SEND CHAT] ' + JSON.stringify(args));

				if (typeof args.to === "undefined" || typeof args.to.chat_id === "undefined")
					return false;

				return sendchat(custom_bot, args.text, args.to.chat_id);
			})
			.getArgument('to')
			.registerAutocompleteListener((query, args) => {
				return Promise.resolve(chat_ids);
			});

		this.sendImage = this.homey.flow.getActionCard('sendimage')
			.registerRunListener(async (args) => {

				console.log("[SEND IMAGE] " + JSON.stringify(args));

				bot_token = this.homey.settings.get('bot_token');

				let image = args.droptoken;

				if (typeof image === "undefined" || image == null) {
					return false;
				}

				const form = new FormData();
				form.append('chat_id', args.to.chat_id);

				//if (image.getStream) {

					console.log("get stream");

					const stream = await image.getStream();
					form.append('photo', stream, {
						contentType: stream.contentType,
						filename: stream.filename,
						name: 'photo',
					});
				/*} else {//backwards compatibility

					const buf = await image.getBuffer();

					if (typeof buf === 'string') {
						form.append('photo', buf);
					} else {

						form.append('photo', buf, {
							contentType: CONTENT_TYPES[image.getFormat()],
							filename: 'x.' + image.getFormat(),
							name: 'photo',
						});
					}
				}*/

				if (bot_token) {
					var response = await fetch("https://api.telegram.org/bot" + bot_token + "/sendPhoto", {
						method: 'POST',
						body: form.pipe(new PassThrough()),
						headers: form.getHeaders(),
					});
				} else {
					var response = await fetch("https://telegram.corbata.nl/?action=sendPhoto", {
						method: 'POST',
						body: form.pipe(new PassThrough()),
						headers: form.getHeaders(),
					});
				}

				if (!response.ok) {
					console.log('Response:', await response.text());
					return false;
				}

				const body = await response.json();
				return (response.ok && body && body.ok && body.ok === true);

			})
			.getArgument('to')
			.registerAutocompleteListener(async (query, args) => {
				return chat_ids;
			});

		//jorro hier de eventtrigger card?
		//jorro:
		this.eventTrigger = this.homey.flow.getTriggerCard('incomingmessage');

		// Register initial webhook
		if (Homey.env.CLIENT_ID && Homey.env.CLIENT_SECRET) {

			console.log('registering webhook...')
			this.register_webhook();

		} else {

			console.log("Missing env.json ... receiving messages will not work.")

		}

	}

	async unregister_webhook() {

		return await this.homey.cloud.unregisterWebhook(this.myWebhook);

	}

	async register_webhook() {

		let device_id = this.homey.settings.get('device_id');
		chat_ids = this.homey.settings.get('chat_ids');

		let data = {
			device_id: device_id,
			chat_ids: chat_ids
		}

		// Register webhook
		this.myWebhook = await this.homey.cloud.createWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET, data);

		this.myWebhook.on('message', args => {

			console.log('[INCOMING] ' + JSON.stringify(args));

			var custom_bot = this.homey.settings.get('bot_token');

			// Check if message isn't undefined
			if (args.body.message != undefined) {
				if (args.body.message.message_id != last_msg_id || typeof last_msg_id === "undefined" || (typeof args.body.message.text !== "undefined" && args.body.message.text.substr(0, 10) == '/register ')) {

					last_msg_id = args.body.message.message_id;

					if (typeof args.body.message.text !== "undefined") {

						if (args.body.message.text.substr(0, 10) == '/register ' && args.body.message.text == '/register ' + device_id) {

							chat_ids = this.homey.settings.get('chat_ids');

							//See if it is not yet in the list of chat_ids:

							if (chat_ids != null) {

								let obj = chat_ids.find(o => o.chat_id == args.body.message.chat.id);

								console.log("XXX Done scanning, obj = " + typeof obj);

								if (typeof obj === "undefined") {

									if (typeof args.body.message.chat.type !== undefined && args.body.message.chat.type == 'group') {

										chat_ids.push({
											image: 'https://telegram.org/img/t_logo.png',
											name: args.body.message.chat.title,
											description: this.homey.__("group"),
											chat_id: args.body.message.chat.id
										});

									} else {

										if (typeof args.body.message.from.last_name !== "undefined") {

											var name = args.body.message.from.first_name + ' ' + args.body.message.from.last_name

										} else {

											var name = args.body.message.from.first_name

										}
										
										chat_ids.push({
											image: 'https://telegram.org/img/t_logo.png',
											name: name,
											chat_id: args.body.message.chat.id
										});

									}

									console.log('chat_id added: ' + args.body.message.chat.id);

									this.homey.settings.set('chat_ids', chat_ids);

									console.log('[chat_ids] ' + JSON.stringify(chat_ids));

									this.unregister_webhook();
									this.register_webhook();

									sendchat(custom_bot, this.homey.__("registered"), args.body.message.chat.id);

								} else {

									console.log("Already exists");
									sendchat(custom_bot, this.homey.__("already_registered"), args.body.message.chat.id);

								}

							} else {

								chat_ids = [];

								if (typeof args.body.message.chat.type !== undefined && args.body.message.chat.type == 'group') {

									chat_ids.push({
										image: 'https://telegram.org/img/t_logo.png',
										name: args.body.message.chat.title,
										description: this.homey.__("group"),
										chat_id: args.body.message.chat.id
									});

								} else {

									if (typeof args.body.message.from.last_name !== "undefined") {

										var name = args.body.message.from.first_name + ' ' + args.body.message.from.last_name

									} else {

										var name = args.body.message.from.first_name

									}

									chat_ids.push({
										image: 'https://telegram.org/img/t_logo.png',
										name: name,
										chat_id: args.body.message.chat.id
									});

								}

								console.log('chat_id added: ' + args.body.message.chat.id);

								this.homey.settings.set('chat_ids', chat_ids);

								console.log('[chat_ids] ' + JSON.stringify(chat_ids));

								this.unregister_webhook();
								this.register_webhook();

								sendchat(custom_bot, this.homey.__("registered"), args.body.message.chat.id);

							}

						} else if (args.body.message.text.substr(0, 5) == '/help') { // && args.body.message.bot_id ==

							sendchat(custom_bot, 'INFO: ' + JSON.stringify(args.body), args.body.message.chat.id);
							sendchat(custom_bot, this.homey.__("help"), args.body.message.chat.id);


						} else if (args.body.message.text == 'ping') {

							sendchat(custom_bot, 'pong', args.body.message.chat.id);

						} else if (args.body.message.text == 'pong') {

							sendchat(custom_bot, 'ping', args.body.message.chat.id);

						} else {

							if (typeof args.body.message.from.last_name !== "undefined") {

								var name = args.body.message.from.first_name + ' ' + args.body.message.from.last_name

							} else {

								var name = args.body.message.from.first_name

							}

							// Trigger event
							this.eventTrigger
								.trigger({
									message: args.body.message.text || '',
									user: name || ''
								})
								.then(this.log)
								.catch(this.error);
						}

					}

				}
			}
			//JORRO_END

		})

	}
}

async function sendchat (bot_token, message, chat_id) {

	if (bot_token) {
		var result = await fetch('https://api.telegram.org/bot' + bot_token + '/sendMessage?chat_id=' + chat_id + '&parse_mode=Markdown&text=' + encodeURIComponent(message));
	} else {
		var result = await fetch('https://telegram.corbata.nl/?action=sendMessage&chat_id=' + chat_id + '&parse_mode=Markdown&text=' + encodeURIComponent(message));
	}

	if(!result.ok) {
		console.log('Response:', await result.text());
		return false;
	}

	const body = await result.json();
	return (result.ok && body && body.ok === true);
}

module.exports = App;
