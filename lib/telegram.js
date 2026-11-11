'use strict';

// Thin wrapper around the Telegram Bot API (own bot) and the corbata.nl relay (shared @athomhomey_bot).
// Uses the native fetch / FormData / Blob from Node.js 22.

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';
const RELAY_URL = 'https://telegram.corbata.nl/';

// Telegram answers with a JSON body ({ ok, result } or { ok: false, description }), also on errors.
async function parse_response(response) {

	const raw = await response.text();
	let body = null;

	try {
		body = JSON.parse(raw);
	} catch (e) {
		body = null;
	}

	if (response.ok && body && body.ok === true) {
		return body.result;
	}

	const description = (body && body.description) ? body.description : (raw.slice(0, 200) || 'HTTP ' + response.status);
	const error = new Error('Telegram: ' + description);
	error.status = response.status;
	throw error;
}

// Call a Bot API method on the user's own bot with a JSON body
async function call_bot(bot_token, method, params, signal) {

	const response = await fetch(TELEGRAM_API_URL + bot_token + '/' + method, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params || {}),
		signal: signal
	});

	return parse_response(response);
}

// Call the relay that sends through the shared @athomhomey_bot
async function call_relay(action, params) {

	const query = new URLSearchParams(Object.assign({ action: action }, params));
	const response = await fetch(RELAY_URL + '?' + query.toString());

	return parse_response(response);
}

function is_parse_error(error) {
	return error && error.status === 400 && /can't parse entities/i.test(error.message);
}

async function send_message(bot_token, chat_id, text) {

	const send = (params) => bot_token ? call_bot(bot_token, 'sendMessage', params) : call_relay('sendMessage', params);

	const params = {
		chat_id: chat_id,
		text: String(text ?? '')
	};

	try {
		return await send(Object.assign({ parse_mode: 'Markdown' }, params));
	} catch (error) {
		// Unbalanced Markdown characters (_ * ` [) make Telegram reject the message, retry as plain text
		if (is_parse_error(error)) {
			return send(params);
		}
		throw error;
	}
}

// Upload the image itself (to the own bot or through the relay), so Telegram never has to reach the Homey cloud URL
async function send_photo_upload(bot_token, chat_id, stream) {

	const chunks = [];
	for await (const chunk of stream) {
		chunks.push(chunk);
	}

	const content_type = stream.contentType || 'image/jpeg';
	const filename = stream.filename || 'image.' + (content_type.split('/')[1] || 'jpg');

	const form = new FormData();
	form.append('chat_id', String(chat_id));
	form.append('photo', new Blob([Buffer.concat(chunks)], { type: content_type }), filename);

	const url = bot_token ? TELEGRAM_API_URL + bot_token + '/sendPhoto' : RELAY_URL + '?action=sendPhoto';
	const response = await fetch(url, {
		method: 'POST',
		body: form
	});

	return parse_response(response);
}

// Let Telegram download the image from a public URL
async function send_photo_url(bot_token, chat_id, url) {

	if (bot_token) {
		return call_bot(bot_token, 'sendPhoto', { chat_id: chat_id, photo: url });
	}

	return call_relay('sendPhoto', { chat_id: chat_id, url: url });
}

async function get_me(bot_token) {
	return call_bot(bot_token, 'getMe');
}

async function delete_webhook(bot_token) {
	return call_bot(bot_token, 'deleteWebhook');
}

// Long polling: Telegram keeps the request open for up to `timeout` seconds until a message arrives
async function get_updates(bot_token, offset, timeout, signal) {

	const request_signal = AbortSignal.any([signal, AbortSignal.timeout((timeout + 15) * 1000)]);

	return call_bot(bot_token, 'getUpdates', {
		offset: offset,
		timeout: timeout,
		allowed_updates: ['message']
	}, request_signal);
}

// Tell the relay which chats this Homey is connected to, so it knows where to forward shared bot messages
async function sync_relay(device_id, chat_ids) {

	const response = await fetch(RELAY_URL + '?action=sync', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ device_id: device_id, chat_ids: chat_ids }),
		signal: AbortSignal.timeout(20000)
	});

	const raw = await response.text();
	let body = null;
	try {
		body = JSON.parse(raw);
	} catch (e) {
		body = null;
	}

	if (!response.ok || !body || body.ok !== true) {
		throw new Error('Relay sync failed: ' + ((body && body.description) || 'HTTP ' + response.status));
	}

	return body;
}

module.exports = {
	send_message,
	send_photo_upload,
	send_photo_url,
	get_me,
	delete_webhook,
	get_updates,
	sync_relay
};
