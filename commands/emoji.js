const Command = require('../command');
const { send, config } = require('../util/util');

const MAX_EMOJIS = 20;

module.exports = new Command(
	'emoji',
	'Sends an animated emoji. Only works with animated emoji.',
	`emoji <animated emoji name> <optional number to repeat 1-${MAX_EMOJIS}>`,
	'emoji yeet 5',
	(message, args) => {
		const argsWords = args.split(' ');
		const animatedEmojis = message.guild.emojis.cache.filter((r) => r.animated);
		const emoji = animatedEmojis.find((r) => r.name === argsWords[0]);
		if (emoji) {
			message.delete();
			let numEmojis = +argsWords[1];
			if (argsWords.length < 2 || !(numEmojis >= 1 && numEmojis <= MAX_EMOJIS)) {
				numEmojis = 1;
			}
			send(message.channel, emoji.toString().repeat(numEmojis));
		} else {
			const randomEmoji = animatedEmojis.random()?.name || '';
			const emojiString = animatedEmojis.map((r) => r.toString()).join(' ');
			send(message.channel, `Animated emojis you can use are: ${emojiString}. Try \`${config.get('options.prefix')}emoji ${randomEmoji}\``);
		}
	},
);
