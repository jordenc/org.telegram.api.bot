const Homey 		= require('homey');
const fetch 		= require('node-fetch');

module.exports =
{
    async addbot({homey, body: {bot_token}}){

        const result = await fetch('https://api.telegram.org/bot' + bot_token + '/setWebhook?url=https://webhooks.athom.com/webhook/' + Homey.env.CLIENT_ID);

        if(!result.ok) {
            console.log('Response:', await result.text());
            return ('Error ' + result.response.statusCode + ': ' + result.data, false);
        }

        const body = await result.json();
        if (result.ok && body && body.ok === true){

            homey.settings.set('bot_token', bot_token);

            return true;

        }

    },

    async deletebot({homey, args}){

       const result = await fetch('https://api.telegram.org/bot' + homey.settings.get('bot_token') + '/setWebhook?url=');

        if(!result.ok) {
            console.log('Response:', await result.text());
            return false;
        }

        const body = await result.json();
        if (result.ok && body && body.ok === true){

            homey.settings.set('bot_token', '');
            return true;

        }

    },

    async renew_webhook({homey, args}){

       var result = await homey.app.unregister_webhook();

       var result = await homey.app.register_webhook();

       return result;

    },

    async send_message({homey, args}){

       console.log ("received: " + JSON.stringify(args));

       var chat_id = args.query.to;
       var message = args.query.text;

       var custom_bot = homey.settings.get('bot_token');

       if (custom_bot) {
           const result = await fetch('https://api.telegram.org/bot' + custom_bot + '/sendMessage?chat_id=' + chat_id + '&parse_mode=Markdown&text=' + encodeURIComponent(message));
       } else {
           const result = await fetch('https://telegram.corbata.nl/?action=sendMessage&chat_id=' + chat_id + '&text=' + encodeURIComponent(message));
       }

       if(!result.ok) {
           console.log('Response:', await result.text());
           return false;
       }

       const body = await result.json();
       return (result.ok && body && body.ok === true);

    }
}