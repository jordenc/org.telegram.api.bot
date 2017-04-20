# Homey Telegram communication

Use Telegram (https://telegram.org/) with Homey: Send and receive messages in flows.

**Want to show your appreciation for this app? A donation is possible via http://www.d2c.nl **

There are 2 ways to use this app:

# 1: Easy way (less secure)
Use our @athomhomey_bot which is a shared bot. In theory we might be able to read the messages you send to the bot and back. We will not do that, but it is technically possible.

# 2: Slightly harder way (fully secure)
Set up your own Telegram bot. This is fully secure and private, since you are the only one who can access the message archive.

Before you can use this app, you first have to follow the steps on the Settings page in Homey.

# Built in commands
There are several built in commands (and more coming) for you to play with. I plan to extend this app to be able to control a lot of devices/apps on Homey.

As of now, send a message to the Telegram bot:
- /say ...
Fill in something on the dots to make Homey say it.
- /ask ...
Ask a question via Homey and receive the answer via Telegram
- /snap
Shows a list of cameras available if you have the Synology Surveillance Station app installed. Select one and you will receive a snapshot (Might take a few seconds)
- ping
Receive 'pong'
- pong
Receive 'ping'
- /help


# Changelog
**Version 0.1.6** 
- Small update that sends an error to the chat if snapshotting via Synology does not work.

**Version 0.1.5** 
- Building support for sending images via Tokens (For example, Synology and Doorbird)

**Version 0.1.4** 
- It's now possible to retrieve a list of cameras if you have the Synology Surveillance Station app installed on Homey

**Version 0.1.3**
- Started on built in commands

**Version 0.1.2**
- Fixed a bug introduced in version 0.1.1

**Version 0.1.1**
- Made a fix to prevent messages coming in twice

**Version 0.1.0**
- First released version