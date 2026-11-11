'use strict';

const Homey = require('homey');
const crypto = require('crypto');
const telegram = require('./lib/telegram');

const CHAT_IMAGE = 'https://telegram.org/img/t_logo.png';
const GROUP_TYPES = ['group', 'supergroup', 'channel'];

class App extends Homey.App {

	async onInit() {

		this.webhook = null;
		this.connection_queue = Promise.resolve();
		this.last_msg_key = null;
		this.polling = null;
		this.poll_offset = 0;
		this.poll_token = null;

		this.ensure_device_id();
		this.ensure_api_key();

		this.log('Registered chats: ' + this.get_chat_ids().length + ', own bot: ' + (this.get_bot_token() ? 'yes' : 'no'));

		const chat_autocomplete = async (query) => {
			const search = String(query || '').toLowerCase();
			return this.get_chat_ids().filter(chat => String(chat.name || '').toLowerCase().includes(search));
		};

		this.homey.flow.getActionCard('sendmessage')
			.registerRunListener(async (args) => {
				const chat = this.require_chat(args.to);
				await this.send_text(chat.chat_id, args.text);
				return true;
			})
			.registerArgumentAutocompleteListener('to', chat_autocomplete);

		this.homey.flow.getActionCard('sendimage')
			.registerRunListener(async (args) => {
				const chat = this.require_chat(args.to);
				if (!args.droptoken) {
					throw new Error(this.homey.__('errors.no_image'));
				}
				await this.send_image(chat.chat_id, args.droptoken);
				return true;
			})
			.registerArgumentAutocompleteListener('to', chat_autocomplete);

		this.event_trigger = this.homey.flow.getTriggerCard('incomingmessage');

		// Switch between own bot (long polling) and shared bot (relay + Athom webhook) when the token changes
		this.homey.settings.on('set', key => this.on_setting_changed(key));
		this.homey.settings.on('unset', key => this.on_setting_changed(key));

		this.update_connection().catch(error => this.error('Connecting failed:', error.message));
	}

	async onUninit() {
		this.stop_polling();
	}

	on_setting_changed(key) {

		if (key !== 'bot_token') {
			return;
		}

		const bot_token = this.get_bot_token();
		if (bot_token === this.poll_token) {
			return;
		}

		this.update_connection().catch(error => this.error('Connecting failed:', error.message));
	}

	// ---------------------------------------------------------------------------------------------
	// Settings helpers
	// ---------------------------------------------------------------------------------------------

	ensure_device_id() {

		if (this.homey.settings.get('device_id')) {
			return;
		}

		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let device_id = '';
		for (let i = 0; i < 10; i++) {
			device_id += possible.charAt(crypto.randomInt(possible.length));
		}

		this.homey.settings.set('device_id', device_id);
		this.log('New device_id generated');
	}

	ensure_api_key() {
		if (!this.homey.settings.get('api_key')) {
			this.regenerate_api_key();
		}
	}

	regenerate_api_key() {
		const api_key = crypto.randomBytes(24).toString('hex');
		this.homey.settings.set('api_key', api_key);
		return api_key;
	}

	check_api_key(key) {

		const expected = Buffer.from(String(this.homey.settings.get('api_key') || ''));
		const given = Buffer.from(String(key || ''));

		if (expected.length === 0 || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
			const error = new Error('Invalid or missing API key');
			error.statusCode = 401;
			throw error;
		}
	}

	get_bot_token() {
		return this.homey.settings.get('bot_token') || null;
	}

	get_chat_ids() {
		const chat_ids = this.homey.settings.get('chat_ids');
		return Array.isArray(chat_ids) ? chat_ids : [];
	}

	// Validate a flow "to" argument against the currently registered chats
	require_chat(to) {

		const chat = to && this.get_chat_ids().find(o => String(o.chat_id) === String(to.chat_id));

		if (!chat) {
			throw new Error(this.homey.__('errors.unknown_receiver'));
		}

		return chat;
	}

	// Find a registered chat by chat_id or name, used by the web API
	find_chat(to) {

		const chat_ids = this.get_chat_ids();

		if (to === undefined || to === null || to === '') {
			if (chat_ids.length === 1) {
				return chat_ids[0];
			}
			throw new Error('Parameter "to" is required when more than one chat is registered');
		}

		const search = String(to).toLowerCase();
		const chat = chat_ids.find(o => String(o.chat_id) === String(to))
			|| chat_ids.find(o => String(o.name || '').toLowerCase() === search);

		if (!chat) {
			throw new Error('Unknown receiver "' + to + '", it must be a registered chat_id or name');
		}

		return chat;
	}

	// ---------------------------------------------------------------------------------------------
	// Sending
	// ---------------------------------------------------------------------------------------------

	async send_text(chat_id, text) {
		return telegram.send_message(this.get_bot_token(), chat_id, text);
	}

	async send_image(chat_id, image) {

		const bot_token = this.get_bot_token();

		// Upload the image itself (own bot directly, shared bot through the relay)
		try {
			const stream = await image.getStream();
			return await telegram.send_photo_upload(bot_token, chat_id, stream);
		} catch (error) {
			this.error('Uploading image failed, falling back to URL:', error.message);
		}

		// Upload failed: let Telegram fetch it from the Homey cloud URL
		return telegram.send_photo_url(bot_token, chat_id, await this.get_image_url(image));
	}

	async get_image_url(image) {

		let url = image.cloudUrl;

		if (!url) {
			const homey_id = await this.homey.cloud.getHomeyId();
			url = 'https://' + homey_id + '.connect.athom.com/api/image/' + image.id;
		}

		// Cache buster, otherwise Telegram keeps showing the first image it fetched from this URL
		return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
	}

	// ---------------------------------------------------------------------------------------------
	// Receiving messages
	//
	// Own bot:    Homey polls Telegram directly (getUpdates), no cloud in between.
	// Shared bot: Telegram -> telegram.corbata.nl (knows which chat belongs to which Homey)
	//             -> Athom webhook, routed on homey_device_id in the body (Key Path) -> this Homey ($key).
	// ---------------------------------------------------------------------------------------------

	// Connection changes are queued, so they never run at the same time
	queue_connection(task) {
		const run = this.connection_queue.then(task);
		this.connection_queue = run.catch(() => {});
		return run;
	}

	// Full (re)connect, used at startup, when the bot token changes and by the settings page
	update_connection() {
		return this.queue_connection(async () => {

			const bot_token = this.get_bot_token();

			if (bot_token) {
				await this.unregister_webhook();
				// Messages to the shared bot no longer need to reach this Homey
				await this.sync_relay([]);
				this.start_polling(bot_token);
				this.log('Receiving messages through own bot (long polling)');
			} else {
				this.stop_polling();
				await this.register_webhook();
				await this.sync_relay(this.get_chat_ids().map(o => o.chat_id));
				this.log('Receiving messages through the shared bot');
			}
		});
	}

	// The settings page button: reconnect everything
	renew_webhook() {
		this.stop_polling();
		return this.update_connection();
	}

	// After the list of chats changed. Polling does not depend on it, so it keeps running
	refresh_chats() {
		return this.queue_connection(async () => {
			if (!this.get_bot_token()) {
				await this.register_webhook();
				await this.sync_relay(this.get_chat_ids().map(o => o.chat_id));
			}
		});
	}

	async unregister_webhook() {

		if (!this.webhook) {
			return;
		}

		try {
			await this.homey.cloud.unregisterWebhook(this.webhook);
		} catch (error) {
			this.error('Unregistering webhook failed:', error.message);
		}
		this.webhook = null;
	}

	async register_webhook() {

		await this.unregister_webhook();

		if (!this.homey.env.CLIENT_ID || !this.homey.env.CLIENT_SECRET) {
			this.log('Missing env.json, receiving messages through the shared bot will not work.');
			return;
		}

		const device_id = this.homey.settings.get('device_id');

		const data = {
			// Athom routes on homey_device_id in the body that the relay forwards (Key Path)
			$key: device_id,
			// Still used by the legacy cloud function until Athom switches routing
			device_id: device_id,
			chat_ids: this.get_chat_ids()
		};

		this.webhook = await this.homey.cloud.createWebhook(this.homey.env.CLIENT_ID, this.homey.env.CLIENT_SECRET, data);
		this.webhook.on('message', args => {
			this.handle_update(args ? args.body : null).catch(error => this.error('Handling incoming message failed:', error.message));
		});
	}

	async sync_relay(chat_ids) {

		let result;

		try {
			result = await telegram.sync_relay(this.homey.settings.get('device_id'), chat_ids);
		} catch (error) {
			this.error(error.message);
			return;
		}

		if (!Array.isArray(result.rejected) || result.rejected.length === 0) {
			return;
		}

		// The relay did not accept these chats (already linked to another Homey, or too late for the migration).
		// Ask the user once to send /register again, that proves they are in the chat.
		const notified = this.homey.settings.get('relay_notified') || [];
		const message = this.homey.__('relay_reregister', { code: '/register ' + this.homey.settings.get('device_id') });

		for (const chat_id of result.rejected) {

			if (notified.includes(String(chat_id))) {
				continue;
			}

			try {
				await this.send_text(chat_id, message);
				notified.push(String(chat_id));
			} catch (error) {
				this.error('Could not ask chat ' + chat_id + ' to register again:', error.message);
			}
		}

		this.homey.settings.set('relay_notified', notified);
	}

	start_polling(bot_token) {

		if (this.polling && this.poll_token === bot_token) {
			return;
		}

		this.stop_polling();

		if (this.poll_token !== bot_token) {
			this.poll_offset = 0;
		}

		const controller = new AbortController();
		this.polling = controller;
		this.poll_token = bot_token;

		this.poll_loop(bot_token, controller.signal).catch(error => this.error('Polling stopped:', error.message));
	}

	stop_polling() {

		if (this.polling) {
			this.polling.abort();
			this.polling = null;
		}

		if (!this.get_bot_token()) {
			this.poll_token = null;
		}
	}

	async poll_loop(bot_token, signal) {

		let failures = 0;

		while (!signal.aborted) {

			try {
				const updates = await telegram.get_updates(bot_token, this.poll_offset, 50, signal);
				failures = 0;

				for (const update of updates) {
					// The next getUpdates call with this offset confirms the update to Telegram
					this.poll_offset = update.update_id + 1;
					await this.handle_update(update).catch(error => this.error('Handling incoming message failed:', error.message));
				}

			} catch (error) {

				if (signal.aborted) {
					break;
				}

				// A webhook is still set on the bot (older app version), remove it once
				if (error.status === 409 && /webhook/i.test(error.message)) {
					this.log('Removing old webhook from own bot');
					await telegram.delete_webhook(bot_token).catch(e => this.error('Removing webhook failed:', e.message));
					continue;
				}

				failures++;

				// 401: token revoked, 409: another Homey is polling the same bot. Retry slowly
				const delay = (error.status === 401 || error.status === 409) ? 5 * 60 * 1000 : Math.min(60000, 1000 * 2 ** failures);
				this.error('Polling failed (' + error.message + '), retrying in ' + Math.round(delay / 1000) + 's');

				await this.sleep(delay, signal);
			}
		}
	}

	sleep(ms, signal) {
		return new Promise(resolve => {
			const timer = this.homey.setTimeout(resolve, ms);
			signal.addEventListener('abort', () => {
				this.homey.clearTimeout(timer);
				resolve();
			}, { once: true });
		});
	}

	async handle_update(update) {

		const message = update ? update.message : undefined;

		if (!message || !message.chat || typeof message.text !== 'string') {
			return;
		}

		const chat_id = message.chat.id;
		const text = message.text;
		const is_register = text.startsWith('/register ');

		// The webhook can deliver the same update more than once
		const msg_key = chat_id + ':' + message.message_id;
		if (msg_key === this.last_msg_key && !is_register) {
			return;
		}
		this.last_msg_key = msg_key;

		this.log('[INCOMING] chat ' + chat_id + ' (' + message.chat.type + ')');

		if (is_register) {
			// "/register <other id>" is meant for another Homey on the shared bot, ignore it
			if (text.trim() === '/register ' + this.homey.settings.get('device_id')) {
				await this.register_chat(message);
			}
			return;
		}

		// Everything below is only for chats that registered with this Homey
		if (!this.get_chat_ids().some(o => String(o.chat_id) === String(chat_id))) {
			this.log('Ignoring message from unregistered chat ' + chat_id);
			return;
		}

		// Phones often capitalize the first letter, so "Ping" counts too
		const command = text.trim().toLowerCase();

		if (command.startsWith('/help')) {
			await this.send_text(chat_id, this.homey.__('help'));
		} else if (command === 'ping') {
			await this.send_text(chat_id, 'pong');
		} else if (command === 'pong') {
			await this.send_text(chat_id, 'ping');
		} else {
			await this.event_trigger.trigger({
				message: text,
				user: this.get_sender_name(message)
			});
		}
	}

	async register_chat(message) {

		const chat = message.chat;
		const chat_ids = this.get_chat_ids();

		if (chat_ids.some(o => String(o.chat_id) === String(chat.id))) {
			await this.send_text(chat.id, this.homey.__('already_registered'));
			return;
		}

		const entry = {
			image: CHAT_IMAGE,
			name: this.get_sender_name(message),
			chat_id: chat.id
		};

		if (GROUP_TYPES.includes(chat.type)) {
			entry.name = chat.title || entry.name;
			entry.description = this.homey.__('group');
		}

		chat_ids.push(entry);
		this.homey.settings.set('chat_ids', chat_ids);
		this.log('Chat registered: ' + chat.id);

		await this.refresh_chats();
		await this.send_text(chat.id, this.homey.__('registered'));
	}

	get_sender_name(message) {

		const from = message.from || message.chat || {};
		const name = [from.first_name, from.last_name].filter(Boolean).join(' ');

		return name || from.username || from.title || '';
	}
}

module.exports = App;
