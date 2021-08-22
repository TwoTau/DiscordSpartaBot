/* eslint-disable global-require */
const discord = require('discord.js');
const fs = require('fs').promises;
const moment = require('moment');
const stringSimilarity = require('string-similarity');
const Command = require('./command');
const LogCommand = require('./logcommand');
const { config, send, reply, getAuthorNickname } = require('./util/util');

const bot = new discord.Client({
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: true,
	},
	intents: [
		discord.Intents.FLAGS.GUILDS,
		discord.Intents.FLAGS.GUILD_MEMBERS,
		discord.Intents.FLAGS.GUILD_MESSAGES,
		discord.Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
		discord.Intents.FLAGS.GUILD_PRESENCES,
		discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		discord.Intents.FLAGS.DIRECT_MESSAGES,
	],
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
let greetingWords = [];
async function getGreetings() {
	const GREETINGS_FILE = config.get('greetings_file');
	let data = [];
	if (GREETINGS_FILE) {
		try {
			data = (await fs.readFile(GREETINGS_FILE, 'utf-8')).split('\n');
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Could not read from ${GREETINGS_FILE}: ${error.code}`);
		}
	} else {
		// eslint-disable-next-line no-console
		console.log('Greetings filed not specified.');
	}
	return data;
}
getGreetings().then((a) => {
	greetingWords = a;
});

bot.on('messageCreate', async (message) => {
	const sender = message.author;

	// only respond to real users and on text (non-DM) channels
	if (sender.bot || message.channel.type !== 'GUILD_TEXT') {
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
		const collector = sent.createReactionCollector({
			filter: (reaction, user) => reaction.emoji.name === CONFIRM_REACTION && user.id === sender.id,
			time: 8000,
		});

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

	const greetingWord = greetingWords.filter((greeting) => cleanContent === greeting || (cleanContent.includes(greeting) && cleanContent.includes(bot.user.username.toLowerCase())));

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
				message.channel.send({ embeds: [embed] });
			} else { // there is an argument
				const { command, confidence } = extractCommand(prefix + optionalArgument);
				// show the command even if it is normally hidden from help
				if (confidence > 0.5) {
					const embed = new discord.MessageEmbed()
						.setTitle(`Command: ${prefix}${command.name}`)
						.addField('Usage', prefix + command.usage)
						.addField('Description', command.description)
						.addField('Example', prefix + command.exampleUsage);

					message.channel.send({ embeds: [embed] });
				} else { // not a valid command
					send(message.channel, `Command ${prefix + optionalArgument} does not exist. Try \`${prefix}help\` for a list of commands.`);
				}
			}
		},
	},
];

bot.login(config.get('discord_token'));
