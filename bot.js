/* eslint-disable global-require */
const discord = require('discord.js');
const moment = require('moment');
const stringSimilarity = require('string-similarity');
const Command = require('./command');
const LogCommand = require('./logcommand');
const { config, send, reply, getAuthorNickname } = require('./util/util');

const bot = new discord.Client({
	disableMentions: 'everyone',
	ws: {
		intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES', 'GUILD_EMOJIS', 'GUILD_PRESENCES', 'GUILD_MESSAGE_REACTIONS', 'DIRECT_MESSAGES'],
	},
});

Command.bot = bot;
LogCommand.initialize();
let commands = [];

bot.on('ready', () => {
	Command.debug(`Now online - ${moment().format('M/DD h:mm a')}`);
	bot.user.setActivity(`since ${moment().format('h:mm a')}`, { type: 'WATCHING' });
});

/**
 * Returns the appropriate command (or null) from specified message content.
 * If there was no exact match, returns the closest command (or null if confidence = 0).
 * If an exact match, confidence is 1.
 *
 * @param {string} messageContent
 * @returns {{command: ?Command, confidence: number}} The found command and confidence
 */
function extractCommand(messageContent) {
	const prefix = config.get('options.prefix');

	if (!messageContent.startsWith(prefix)) {
		return { confidence: 0 };
	}
	const firstWord = messageContent.split(' ')[0].substr(prefix.length).toLowerCase();

	const exactMatch = commands.find((command) => firstWord === command.name);
	if (exactMatch) {
		return {
			command: exactMatch,
			confidence: 1,
		};
	}

	const { bestMatch } = stringSimilarity.findBestMatch(firstWord, commands.map((command) => command.name));
	return {
		command: commands.find((command) => bestMatch.target === command.name),
		confidence: bestMatch.rating,
	};
}

bot.on('guildMemberAdd', async (member) => {
	member.addRole(config.get('new_member_role'));
	const welcomeChannel = await member.guild.channels.cache.find((c) => c.name === 'general');
	if (welcomeChannel) {
		welcomeChannel.send(`Welcome to the Spartabots server, ${member}! What's your name?`).catch((error) => {
			Command.debug(`Failed to welcome member ${member}: ${error}`);
		});
	}
});

// list of words meaning roughly hello in various languages
const GREETING_WORDS = [
	'ahlan', 'ahoj', 'akkam', 'allianchu', 'aloha', 'alo', 'anyoung', 'avuxeni', 'ayubowan', 'barev', 'bite',
	'bonjou', 'bonjour', 'bonswa', 'chone tao', 'ciao', 'dobry den', 'god dag', 'goedendag', 'good morning',
	'greetings', 'guten tag', 'habari', 'hallo', 'halloj', 'halo', 'hei', 'hej', 'hello', 'hey', 'hi', 'hola',
	'hujambo', 'jambo', 'kaixo', 'kamusta', 'kedu', 'konnichiwa', 'kumno', 'marhaba', 'marhabaan', 'merhaba',
	'mholweni', 'mhoro', 'mihofnima', 'msawa', 'muraho', 'namaskar', 'namaskara', 'namaste', 'ni hao', 'nihao',
	'niltze', 'nǐ hǎo', 'ohayo', 'ola', 'parev', 'privet', 'salaam', 'salama', 'salom', 'salut', 'salve', 'sannu',
	'sawasdee', 'sawubona', 'selam', 'selamat siang', 'shalom', 'shikamoo', 'sveiki', 'vanakkam', 'vandanalu',
	'xin chao', 'xin chào', 'yasou', 'yassas', 'yaxshimusiz', 'yo', 'zdraveite', 'zdravo', 'zdravstvuyte',
	'مرحبا', 'नमस्ते', '你好', '안녕',
];

bot.on('message', async (message) => {
	const sender = message.author;

	// only respond to real users and on text (non-DM) channels
	if (sender.bot || message.channel.type !== 'text') {
		return;
	}

	const messageContent = message.content.trim();

	const { command, confidence } = extractCommand(messageContent);

	if (confidence === 1) {
		const spaceCharacterIndex = messageContent.indexOf(' ');
		const args = (spaceCharacterIndex > 0) ? messageContent.substr(spaceCharacterIndex + 1).trim() : '';
		command.execute(message, args);
		return;
	}
	if (confidence > 0.2) {
		const CONFIRM_REACTION = '✅';
		const sent = await send(message.channel, `:question: Did you mean to use **${config.get('options.prefix')}${command.name}**? React with ${CONFIRM_REACTION} if you did.`);
		const sentReaction = await sent.react(CONFIRM_REACTION);

		// 8 second period for user reaction
		const collector = sent.createReactionCollector(
			(reaction, user) => reaction.emoji.name === CONFIRM_REACTION && user.id === sender.id,
			{ time: 8000 },
		);

		collector.on('collect', () => {
			collector.stop('corrected');
			const spaceCharacterIndex = messageContent.indexOf(' ');
			const args = (spaceCharacterIndex > 0) ? messageContent.substr(spaceCharacterIndex + 1).trim() : '';
			command.execute(message, args);
		}).on('end', (_, reason) => {
			sentReaction.remove();
			if (reason === 'corrected') { // ended from user clicking CONFIRM_REACTION
				const getgood = message.guild.emojis.cache.filter((r) => r.name === 'getgood')?.first() || '';
				sent.edit(`Corrected to **${config.get('options.prefix')}${command.name}**. ${getgood}`);
			} else { // ended from timeout
				sent.edit(`:question: Did you mean to use **${config.get('options.prefix')}${command.name}**?`);
			}
		});

		return;
	}

	const cleanContent = message.cleanContent.toLowerCase();
	const messageWords = cleanContent.split(' ');

	if ((messageWords.includes('door') || messageWords.includes('room')) && (messageWords.includes('can') || messageWords.includes('open') || messageWords.includes('lock') || messageWords.includes('locked'))) {
		message.reply(config.get('automated_message.open_door_message'));
	} else if (cleanContent.includes('www.amazon.com')) {
		const newText = message.cleanContent.trim().replace('www.amazon.com', 'smile.amazon.com');
		reply(message, `Consider using a \`smile.amazon.com\` link instead to donate 0.5% to a charity: ${newText} :slight_smile:`);
	}

	const greetingWord = GREETING_WORDS.filter((greeting) => cleanContent === greeting || (cleanContent.includes(greeting) && cleanContent.includes(bot.user.username.toLowerCase())));

	if (cleanContent.length < 50 && greetingWord.length) {
		const greeting = greetingWord[0][0].toUpperCase() + greetingWord[0].substr(1);
		const name = await getAuthorNickname(message);
		send(message.channel, `${greeting} ${name}`);
	} else if (cleanContent === 'no u' || cleanContent.includes(' no u') || cleanContent.includes('no u ')) {
		if (message.channel.name !== 'general') {
			message.channel.send('no u');
		}
	} else if (Math.random() < 0.0001) { // 0.01% chance
		message.channel.send('Allegedly');
	}
});

commands = [
	require('./commands/info'),
	require('./commands/ping'),
	require('./commands/when'),
	require('./commands/emoji'),
	require('./commands/repeat'),

	require('./commands/togglerole'),
	require('./commands/tbateam'),

	require('./commands/stat'),
	require('./commands/eval'),
	require('./commands/purge'),
	require('./commands/kys'),

	require('./commands/log'),
	require('./commands/tophours'),
	require('./commands/corrections'),
	require('./commands/signedinon'),
	require('./commands/subtracthours'),
	require('./commands/timestats'),
	require('./commands/attendancecsv'),
	require('./commands/preseasonreqs'),

	{
		name: 'help',
		description: "That's this command!",
		usage: 'help <optional command>',
		exampleUsage: 'help tbateam',
		execute: async (message, args) => {
			const optionalArgument = args.toLowerCase().trim();

			const prefix = config.get('options.prefix');

			if (!optionalArgument) { // list every non-hidden command
				const botDisplayName = (await message.guild.members.fetch(bot.user.id)).displayName;
				const githubRepo = config.get('github_repo');
				const githubUrl = `https://github.com/${githubRepo}`;
				const embed = new discord.MessageEmbed()
					.setTitle(`${botDisplayName}'s Command List`)
					.setURL(githubUrl)
					.setColor(0x137CB8)
					.setAuthor(botDisplayName, 'https://www.spartabots.org/images/spartabot-transparent-logo.png')
					.setDescription(`I'm a Discord bot made by <@!${config.get('bot_creator')}>! You can find my source code on my [GitHub repo](${githubUrl} "${githubRepo}"). Here's a list of my commands (there are a few hidden ones).`)
					.setFooter(`${prefix}help ${optionalArgument} requested by ${await getAuthorNickname(message)}`);

				// adds a field to the embed for each command that is not hidden from help
				for (const command of commands) {
					if (!command.hiddenFromHelp) {
						embed.addField(prefix + command.usage, `${command.description}\n__Example__: \`${prefix + command.exampleUsage}\``, false);
					}
				}
				message.channel.send({ embed });
			} else { // there is an argument
				const { command, confidence } = extractCommand(prefix + optionalArgument);
				// show the command even if it is normally hidden from help
				if (confidence > 0.5) {
					const embed = new discord.MessageEmbed()
						.setTitle(`Command: ${prefix}${command.name}`)
						.addField('Usage', prefix + command.usage)
						.addField('Description', command.description)
						.addField('Example', prefix + command.exampleUsage);

					message.channel.send({ embed });
				} else { // not a valid command
					send(message.channel, `Command ${prefix + optionalArgument} does not exist. Try \`${prefix}help\` for a list of commands.`);
				}
			}
		},
	},
];

bot.login(config.get('discord_token'));
