const Homey 	=	require('homey');

module.exports = [
    {
        method: 		'PUT',
        path:			'/addbot/',
        fn: function(args, callback){
           
           var http = require('http.min');
           
           http('https://api.telegram.org/bot' + args.body.bot_token + '/setWebhook?url=https://webhooks.athom.com/webhook/' + Homey.env.CLIENT_ID).then(function (result) {
			  	
			  	if (result.response.statusCode == 200) {
					
					Homey.ManagerSettings.set('bot_token', args.body.bot_token);
				  	callback ('Finished!', true);
			  	
			  	} else {
				
				  	callback ('Error ' + result.response.statusCode + ': ' + result.data, false);
			  	}
			
			});
           			
        }
    },
    {
        method: 		'PUT',
        path:			'/deletebot/',
        fn: function(args, callback){
            
           var http = require('http.min');
           
           http('https://api.telegram.org/bot' + Homey.ManagerSettings.get('bot_token') + '/setWebhook?url=').then(function (result) {
	           
	           Homey.ManagerSettings.set('bot_token', '');
	           
	           callback ('Finished', true);
                      			
        	});
        }
    },
    {
        method: 		'PUT',
        path:			'/renew_webhook/',
        fn: function(args, callback){
	        
	       unregisterWebhook
            
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
        fn: function(args, callback){
           
           console.log ("received: " + JSON.stringify(args));
           var http = require('http.min');

           var chat_id = args.query.to;
           var message = args.query.text;
           
           var custom_bot = Homey.ManagerSettings.get('bot_token');
	
			if (custom_bot !== null && custom_bot != '' && typeof custom_bot != 'undefined') {
				
				bot_token = custom_bot;
				
			} else {
				
				bot_token = Homey.env.BOT_TOKEN;
			
			}
			
			http('https://api.telegram.org/bot' + bot_token + '/sendMessage?chat_id=' + chat_id + '&parse_mode=Markdown&text=' + encodeURIComponent(message)).then(function (result) {
			  	console.log('Code: ' + result.response.statusCode)
			  	console.log('Response: ' + result.data)
			  	
			  	if (result.response.statusCode == 200) callback(null, true); else callback(null, false);
			});
	
        }
    }
]