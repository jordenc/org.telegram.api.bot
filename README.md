# Homey Telegram communication

Use Telegram (https://telegram.org/) with Homey: Send and receive messages in flows, send Homey images to your Telegram chat.

Set up your own Telegram bot. This is fully secure and private, since you are the only one who can access the message archive.

Before you can use this app, you first have to follow the steps on the Settings page in Homey.

# Built in commands for testing
- If you send a message with the text 'ping', you should receive 'pong'
- If you send a message with the text 'pong', you should receive 'ping'


# Changelog

**Version 2.0**
- BREAKING CHANGE: SDK v3 version requires us to drop the 'less secure' shared bot. It is now required to set up your own Telegram bot, which is fully 
secure.
- BREAKING CHANGE: /say command removed (not supported in future Homey editions)

**Version 0.3.4**
- Fix for app crashing

**Version 0.3.3**
- Fix for bug that prevented custom bot setup / deletion

**Version 0.3.2**
- Bugfix

**Version 0.3.1**
- Fix for bug that prevented custom bot setup

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
