const Homey 	=	require('homey');
const fetch 		= require('node-fetch');

module.exports = [
    {
        method: 		'PUT',
        path:			'/addbot/',
        fn: async function(args, callback){
			
			const result = await fetch('https://api.telegram.org/bot' + args.body.bot_token + '/setWebhook?url=https://webhooks.athom.com/webhook/' + Homey.env.CLIENT_ID);
		
			if(!result.ok) {
				console.log('Response:', await result.text());
				callback ('Error ' + result.response.statusCode + ': ' + result.data, false);
				return false;
			}
			
			const body = await result.json();
			if (result.ok && body && body.ok === true){
				
				Homey.ManagerSettings.set('bot_token', args.body.bot_token);
				  	callback ('Finished!', true);
				
			}
           			
        }
    },
    {
        method: 		'PUT',
        path:			'/deletebot/',
        fn: async function(args, callback){
            
           const result = await fetch('https://api.telegram.org/bot' + Homey.ManagerSettings.get('bot_token') + '/setWebhook?url=');
		
			if(!result.ok) {
				console.log('Response:', await result.text());
				return false;
			}
			
			const body = await result.json();
			if (result.ok && body && body.ok === true){
				
				Homey.ManagerSettings.set('bot_token', '');
				callback ('Finished', true);
				
			}

        }
    },
    {
        method: 		'PUT',
        path:			'/renew_webhook/',
        fn: async function(args, callback){
	        
	       var result = Homey.app.unregister_webhook();
            
           var result = Homey.app.register_webhook();
           if( result instanceof Error ) return callback( result );
           return callback( null, result );
            
        }
    },

    /* Required GET input: to (receiver ID), text (message) */
    {
        method: 		'GET',
        path:			'/send_message/',
        public: true,
        fn: async function(args, callback){
           
           console.log ("received: " + JSON.stringify(args));
           var http = require('http.min');

           var chat_id = args.query.to;
           var message = args.query.text;
           
           var custom_bot = Homey.ManagerSettings.get('bot_token');
	
			if (custom_bot !== null) {
				
				bot_token = custom_bot;
				
			} else {
				
				bot_token = Homey.ManagerSettings.get('bot_token');
				
			}
		
			const result = await fetch('https://api.telegram.org/bot' + bot_token + '/sendMessage?chat_id=' + chat_id + '&parse_mode=Markdown&text=' + encodeURIComponent(message));
		
			if(!result.ok) {
				console.log('Response:', await result.text());
				return false;
			}
		
			const body = await result.json();
			return (result.ok && body && body.ok === true);
	
        }
    }
]