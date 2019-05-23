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
- /say ...
Fill in something on the dots to make Homey say it.
- ping
Receive 'pong'
- pong
Receive 'ping'


# Changelog

**Version 0.3.0**
- Reduced app size (replaced request and http.min with node-fetch) (thanks jeroenvollenbrock!)
- Fix endless running flow action send image card (thanks jeroenvollenbrock!)
- Cleaned up code (thanks jeroenvollenbrock!)
- New Homey 2.2.0 Image streaming API  (thanks jeroenvollenbrock!)

**Version 0.2.9**
- Added German lanuage (thanks mapulu!)

**Version 0.2.8**
- Minor bugfix
- Added button to "Renew webhook" from settings page.
- Added logging to settings page

**Version 0.2.7**
- Crash fix

**Version 0.2.6**
- Added token "user" for incoming message triggers.

**Version 0.2.5**
- Added an API function "sendmessage" on request

**Version 0.2.4**
- Support for cyrillic characters (Thanks safronovser!)

**Version 0.2.3**
- Small bugfix for "/register" command which could cause confusion if connected to more than 1 Homey.

**Version 0.2.2**
- Bugfixes

**Version 0.2.0**
- Giant new release with new functionality
- Support for "official" Homey image tokens
- Homey SDK v2 version
- Support for multiple chat ID's
- Support for group chats (only possible to send messages to the group, messages from the group to Homey are NOT read)
- The "/ask insert_question_here" function is no longer available
- This update breaks your flows from the previous version.

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
