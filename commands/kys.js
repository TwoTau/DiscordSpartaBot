const Command = require('../command');
const { isAuthorBotCreator } = require('../util/util');

module.exports = new Command(
	'kys',
	'Restarts this program. Can only be used by the bot creator.',
	'kys',
	'kys',
	async (message) => {
		// disallow killing this program by anyone but the bot creator
		if (!isAuthorBotCreator(message)) {
			message.channel.send(':angry: :regional_indicator_n: :o2: :rage:');
			return;
		}

		await Promise.all([
			message.channel.send(':scream: Shutting down :skull:'),
			Command.debug('Shutting down from `kys`'),
		]);
		await Command.bot.destroy();
		process.exit();
	},
);

module.exports.hideFromHelp();
