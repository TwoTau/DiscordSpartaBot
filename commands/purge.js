const Command = require('../command');
const { config, send, isAuthorBotCreator, isAuthorAdmin, getAuthorNickname } = require('../util/util');

// Shuffles the given array in place
function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * i);
		const temp = array[i];
		array[i] = array[j]; // eslint-disable-line no-param-reassign
		array[j] = temp; // eslint-disable-line no-param-reassign
	}
}

const dystopianQuotes = [
	'It was a pleasure to burn.',
	'Memory is an illusion, nothing more. It is a fire that needs constant tending.',
	"It's a beautiful thing, the destruction of words.",
	'Ignorance is strength.',
	'We control matter because we control the mind. Reality is inside the skull.',
	'Whatever the Party holds to be truth, is truth. It is impossible to see reality except by looking through the eyes of the Party.',
	'We, the Party, control all records, and we control all memories. Then we control the past, do we not?',
	'The most effective way to destroy people is to deny and obliterate their own understanding of their history.',
	'History has stopped. Nothing exists except an endless present in which the Party is always right.',
	"Waves, colored zigzags, a garble of sound: it's the Montreal satellite station, being blocked.",
	'When truth is replaced by silence, the silence is a lie.',
];
shuffle(dystopianQuotes);
let quoteIndex = 0;

module.exports = new Command(
	'purge',
	'Will delete the past _n_ comments. This command can only be used by admins.',
	'purge <number of messages n where n ∈ ℤ ∩ [1,100]>',
	'purge 5',
	async (message, args) => {
		Command.debug(`${message.author} attempted to delete messages in ${message.channel} with command: ${message}.`);

		if (!isAuthorAdmin(message)) {
			message.channel.send('Sorry, but not everyone can be a dictator.');
			return;
		}
		if (config.get('options.restrict_purge_to_bot_creator') && !isAuthorBotCreator(message)) {
			message.channel.send('Sorry, but not everyone should be a dictator.');
			return;
		}

		if (!args) {
			message.channel.send('You need to give me the number of messages to purge (1-100).');
			return;
		}

		const contentAsNumber = parseInt(args, 10);

		// if parameter is valid
		if (!Number.isNaN(contentAsNumber) && contentAsNumber > 0 && contentAsNumber < 101) {
			const results = await message.channel.messages.fetch({ limit: contentAsNumber });
			for (const messageToDelete of results) {
				messageToDelete[1].delete();
			}

			const dystopianQuote = dystopianQuotes[quoteIndex % dystopianQuotes.length];
			quoteIndex += 1;

			send(message.channel, `**${await getAuthorNickname(message)} deleted ${contentAsNumber} messages.**`);
			send(message.channel, `_"${dystopianQuote}"_`);
		} else {
			send(message.channel, `${args} is not an integer between 1-100. No messages will be cleared.`);
		}
	},
);
