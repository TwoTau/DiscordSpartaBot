const Command = require('../command');

module.exports = new Command(
	'repeat',
	'Will repeat your message then delete your message.',
	'repeat <text>',
	'repeat I am a good bot',
	(message, content) => {
		message.delete();
		message.channel.send(content);
	},
);

module.exports.hideFromHelp();
