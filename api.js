'use strict';

const telegram = require('./lib/telegram');

// Shared handler for GET (query string) and POST (JSON body) on /send_message
async function handle_send_message(homey, query, body) {

	const input = Object.assign({}, query || {}, (body && typeof body === 'object') ? body : {});

	homey.app.check_api_key(input.key);

	if (input.text === undefined || input.text === null || String(input.text) === '') {
		throw new Error('Parameter "text" is required');
	}

	const chat = homey.app.find_chat(input.to);
	const result = await homey.app.send_text(chat.chat_id, input.text);

	return {
		ok: true,
		chat_id: chat.chat_id,
		message_id: result ? result.message_id : null
	};
}

module.exports = {

	async addbot({ homey, body }) {

		const bot_token = String((body && body.bot_token) || '').trim();

		if (!/^\d+:[\w-]+$/.test(bot_token)) {
			throw new Error('This does not look like a valid bot token (format: 123456:ABC-DEF...)');
		}

		// Checks the token, throws "Telegram: Unauthorized" when it is wrong
		await telegram.get_me(bot_token);

		// Homey receives messages with long polling, which does not work while a webhook is set
		await telegram.delete_webhook(bot_token);

		// The app picks this up and starts polling
		homey.settings.set('bot_token', bot_token);

		return true;
	},

	async deletebot({ homey }) {

		// The app picks this up, stops polling and switches back to the shared bot
		homey.settings.set('bot_token', '');

		return true;
	},

	async renew_webhook({ homey }) {
		await homey.app.renew_webhook();
		return true;
	},

	// Used by the settings page to show the API key and example URLs
	async api_info({ homey }) {

		const path = '/api/app/' + homey.manifest.id + '/send_message';
		let local_address = null;
		let homey_id = null;

		try {
			local_address = await homey.cloud.getLocalAddress();
		} catch (error) {
			local_address = null;
		}

		try {
			homey_id = await homey.cloud.getHomeyId();
		} catch (error) {
			homey_id = null;
		}

		return {
			api_key: homey.settings.get('api_key'),
			local_url: local_address ? 'http://' + local_address + path : null,
			cloud_url: homey_id ? 'https://' + homey_id + '.connect.athom.com' + path : null
		};
	},

	async regenerate_api_key({ homey }) {
		return { api_key: homey.app.regenerate_api_key() };
	},

	// Public: GET /send_message?key=...&to=...&text=...
	async send_message({ homey, query, body }) {
		return handle_send_message(homey, query, body);
	},

	// Public: POST /send_message with JSON { key, to, text }
	async send_message_post({ homey, query, body }) {
		return handle_send_message(homey, query, body);
	}
};
