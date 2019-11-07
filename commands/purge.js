const Command = require('../command');
const config = require('../config.json');

module.exports = new Command(
	'purge',
	'Will delete the past _n_ comments. This command can only be used by admins.',
	'purge <number of messages n where n ∈ ℤ ∩ [1,100]>',
	'purge 5',
	(message, args) => {
		Command.debug(`${message.author} attempted to delete messages in ${message.channel} with command: ${message}.`);

		if (!Command.isAuthorAdmin(message)) {
			message.channel.send('Sorry, but not everyone can be a dictator.');
			return;
		}
		if (config.options.restrict_purge_to_bot_creator && !Command.isAuthorBotCreator(message)) {
			message.channel.send('Sorry, but not everyone should be a dictator.');
			return;
		}

		if (!args) {
			message.channel.send('Number of messages to purge was not specified. No messages will be cleared.');
			return;
		}

		const contentAsNumber = parseInt(args, 10);

		// if parameter is valid
		if (!Number.isNaN(contentAsNumber) && contentAsNumber > 0 && contentAsNumber < 101) {
			message.channel.fetchMessages({ limit: contentAsNumber }).then((results) => {
				for (const messageToDelete of results) {
					messageToDelete[1].delete();
				}
			});

			const dystopianQuotes = [
				'It was a pleasure to burn.',
				'Memory is an illusion, nothing more. It is a fire that needs constant tending.',
				"It's a beautiful thing, the destruction of words.",
				'Ignorance is strength.',
				'We, the Party, control all records, and we control all memories. Then we control the past, do we not?',
				'The most effective way to destroy people is to deny and obliterate their own understanding of their history.',
				'History has stopped. Nothing exists except an endless present in which the Party is always right.',
			];

			const randomValue = Math.floor(Math.random() * dystopianQuotes.length);
			const dystopianQuote = dystopianQuotes[randomValue];

			message.channel.send(`**${Command.getAuthorNickname(message)} deleted ${contentAsNumber} messages.**`);
			message.channel.send(`_"${dystopianQuote}"_`);
		} else {
			message.channel.send(`${args} is not an integer between 1-100. No messages will be cleared.`);
		}
	},
);
