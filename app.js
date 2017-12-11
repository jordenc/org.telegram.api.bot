"use strict";

const Homey 	=	require('homey');
let http 		=	require('http.min');
let request		=	require('request');

let device_id 	=	Homey.ManagerSettings.get('device_id');
let bot_token	=	Homey.env.BOT_TOKEN;
let chat_ids 	=	Homey.ManagerSettings.get('chat_ids');

let custom_bot_token 	=	Homey.ManagerSettings.get('bot_token');

let found		=	0;

//Homey.ManagerSettings.get('chat_ids');


var last_msg_id;

class App extends Homey.App {
	
	onInit() {
		
		if (typeof chat_ids != "object") {
			this.log ('Not yet registered with chat_ids');
			chat_ids = [];
		} else {
			
			this.log('We still remembered chat_ids: ' + JSON.stringify(chat_ids));
			
		}
		
		if (custom_bot_token) {
			
			bot_token = custom_bot_token;
			
		}
		
		let eventTrigger = new Homey.FlowCardTrigger('incomingmessage')
		.register()
	    .registerRunListener( (args, state ) => {

	        // If true, this flow should run
	        return Promise.resolve(true);
	
	    })
	    
		if (device_id) {

			this.log ('We still remembered device_id: ' + device_id);

		} else {

			var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

			device_id = '';
		    for( var i=0; i < 10; i++ )
		        device_id += possible.charAt(Math.floor(Math.random() * possible.length));

			this.log('new device_id: ' + device_id);
			device_id = Homey.ManagerSettings.set('device_id', device_id);

		}
    
		let sendMessage = new Homey.FlowCardAction('sendmessage');
		sendMessage
		    .register()
		    .registerRunListener(( args, state ) => {
		
				this.log('[SEND CHAT] ' + JSON.stringify (args));
				sendchat (args.text, args.to.chat_id);
				
		    })
		    .getArgument('to')
	        .registerAutocompleteListener(( query, args ) => {
	            return Promise.resolve(chat_ids);
	        });

		let sendImage = new Homey.FlowCardAction('sendimage');
		sendImage
			.register()
			.registerRunListener(( args, state) => {
				
				this.log ("[SEND IMAGE] " + JSON.stringify (args));
				
				let image = args.droptoken;
				image.getBuffer()
				.then( buf => {
					
					var r = request.post("https://api.telegram.org/bot" + bot_token + "/sendPhoto", requestCallback);
					var form = r.form();
					
					form.append('chat_id', args.to.chat_id);
					
					form.append('photo', new Buffer(buf),
						{contentType: 'image/jpeg', filename: 'x.jpg'});
					
					function requestCallback(err, res, body) {
					  console.log(body);
					  
					  if (body.ok == true) {
						  return Promise.resolve(true);
					  } else {
						  return Promise.resolve(false);
					  }
					}
				  
				})
				.catch (this.log("sendimage done"))					
			})
			.getArgument('to')
	        .registerAutocompleteListener(( query, args ) => {
	            return Promise.resolve(chat_ids);
	        });
		
		// Register initial webhook
		if (Homey.env.CLIENT_ID && Homey.env.CLIENT_SECRET) {

			// Register webhook
			let myWebhook = new Homey.CloudWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET, {device_id: device_id});
			
			myWebhook
			.on('message', args => {
				
				this.log('incoming webhook: ' + JSON.stringify(args));
		
				//this.log ('args.body.message.message_id = ' + args.body.message.message_id);
				//this.log ('last_msg_id = ' + last_msg_id);
				
				this.log('[INCOMING] ' + JSON.stringify(args));
				
				if (args.body.message.message_id > last_msg_id || typeof last_msg_id === "undefined") {
					
					last_msg_id = args.body.message.message_id;
					
					if (typeof args.body.message.text !== "undefined") {
						
						if (args.body.message.text.substr(0,10) == '/register ') {
							
							this.log ('[args] ' + JSON.stringify (args));
							
							found = 0;
							
							//See if it is not yet in the list of chat_ids:
							let obj = chat_ids.find(o => o.chat_id === args.body.message.chat.id + 1);
							
							if (typeof obj === "undefined") {
							
								if (typeof args.body.message.chat.type !== undefined && args.body.message.chat.type == 'group') {
									
									chat_ids.push({
					                    image: 'https://telegram.org/img/t_logo.png', 
					                    name: args.body.message.chat.title,
					                    description: Homey.__("group"),
					                    chat_id: args.body.message.chat.id
					                });
				                
								} else {
									
									chat_ids.push({
					                    image: 'https://telegram.org/img/t_logo.png', 
					                    name: args.body.message.from.first_name + ' ' + args.body.message.from.last_name,
					                    chat_id: args.body.message.chat.id
					                });
					                
					            }
				            
					            this.log('chat_id added: ' + args.body.message.chat.id);
			                
				                Homey.ManagerSettings.set('chat_ids', chat_ids);
				                
				                this.log ('[chat_ids] ' + JSON.stringify(chat_ids));
								
								sendchat (Homey.__("registered"), args.body.message.chat.id);
							
							} else {
								
								sendchat (Homey.__("already_registered"), args.body.message.chat.id);
								
							}
							
						}else if (args.body.message.text.substr(0,5) == '/help') {
							
							sendchat (Homey.__("help"), args.body.message.chat.id);
							
						}else if (args.body.message.text.substr(0,5) == '/say ') {
							
							var output = args.body.message.text.substr(5);
							
							this.log ('test van SAY function: ' + output);
							
							Homey.ManagerSpeechOutput.say( output );
							
						}else if (args.body.message.text.substr(0,5) == '/ask ') {
							
							var question = args.body.message.text.substr(5);
							
							/*
							Homey.ManagerSpeechOutput.ask( question )
								.then() {
									
									sendchat (result, args.body.message.chat.id);
									
								};
							*/
							
						} else if (args.body.message.text.substr(0,12) == '/unregister ') {
							
							Homey.manager('settings').set('chat_id', '');
							sendchat (Homey.__("unregistered"), args.body.message.chat.id);
							chat_id = '';
							this.log('chat_id unregistered');
							self.registerWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET);
							
						} else if (args.body.message.text == 'ping') {
							this.log ('[args] ' + JSON.stringify(args));
							sendchat ('pong', args.body.message.chat.id);
							
						} else if (args.body.message.text == 'pong') {
							
							sendchat ('ping', args.body.message.chat.id);
								
						} else {
						
							// Trigger event
							incomingMessage
				        	.trigger({
				                message: args.body.message.text || ''
			                }, {event: event})
			                .then( console.log( 'incomingmessage triggered') )
			                .catch( this.error )
	                
	                
							
						}
						
					}
				
				}
				
			 })
	        .register()
	        .then(() => {
	             this.log('Webhook registered!');
	             
			})
	        .catch( this.error )
    
		} else {
			
			this.log ("Missing env.json ... receiving messages will not work. Sending will only work if using a custombot.")
			
		}

	}
	
}

function sendchat (message, chat_id) {

	
	http('https://api.telegram.org/bot' + bot_token + '/sendMessage?chat_id=' + chat_id + '&parse_mode=Markdown&text=' + message).then(function (result) {
	  	console.log('Code: ' + result.response.statusCode)
	  	console.log('Response: ' + result.data)
	  	
	  	if (result.response.statusCode == 200) return Promise.resolve(true); else return Promise.resolve(false);
	});
}

module.exports = App;