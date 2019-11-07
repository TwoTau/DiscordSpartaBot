const Command = require('../command');

module.exports = new Command(
	'kys',
	'Restarts this program. Can only be used by the bot creator.',
	'kys',
	'kys',
	async (message) => {
		// disallow killing this program by anyone but the bot creator
		if (!Command.isAuthorBotCreator(message)) {
			message.channel.send(':angry: :regional_indicator_n: :o2: :rage:');
			return;
		}

		await message.channel.send(':scream: Shutting down :skull:');
		await Command.bot.destroy();
		process.exit();
	},
);

module.exports.hideFromHelp();
