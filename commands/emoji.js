const Command = require('../command');

module.exports = new Command(
	'emoji',
	'Sends an animated emoji. Only works with animated emoji.',
	'emoji <animated emoji name> <optional number to repeat 1-10>',
	'emoji yeet 5',
	(message, args) => {
		const argsWords = args.split(' ');
		message.delete();
		const animatedEmojis = message.guild.emojis.filter(r => r.animated);
		const emoji = animatedEmojis.find('name', argsWords[0]);
		if (emoji) {
			let numEmojis = +argsWords[1];
			if (argsWords.length < 2 || !(numEmojis >= 1 && numEmojis <= 10)) {
				numEmojis = 1;
			}
			message.channel.send(emoji.toString().repeat(numEmojis));
		}
	},
);
