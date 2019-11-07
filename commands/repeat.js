const Command = require('../command');

module.exports = new Command(
	'repeat',
	'Will repeat your message then delete it.',
	'repeat <text>',
	'repeat I am a good bot',
	(message, content) => {
		message.channel.send(content);
		message.delete();
	},
);

module.exports.hideFromHelp();
