import 'source-map-support/register';
import * as discord from 'discord.js';
import * as moment from 'moment';
import * as fs from 'fs/promises';
import * as stringSimilarity from 'string-similarity';
import { Snowflake } from 'discord.js';
import Command from './command';
import LogCommand from './logcommand';
import { config, send, reply, getAuthorNickname } from './util/util';

import infoCommand from './commands/info';
import pingCommand from './commands/ping';
import whenCommand from './commands/when';
import emojiCommand from './commands/emoji';
import repeatCommand from './commands/repeat';
import toggleroleCommand from './commands/togglerole';
import tbateamCommand from './commands/tbateam';
import statCommand from './commands/stat';
import evalCommand from './commands/eval';
import purgeCommand from './commands/purge';
import kysCommand from './commands/kys';
import logCommand from './commands/log';
import tophoursCommand from './commands/tophours';
import correctionsCommand from './commands/corrections';
import signedinonCommand from './commands/signedinon';
import subtracthoursCommand from './commands/subtracthours';
import timestatsCommand from './commands/timestats';
import attendancecsvCommand from './commands/attendancecsv';
import preseasonreqsCommand from './commands/preseasonreqs';

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
let botUser: discord.ClientUser;
LogCommand.initialize();
let commands: Command[] = [];

bot.on('ready', () => {
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	botUser = bot.user!;
	Command.debug(`Now online - ${moment().format('M/DD h:mm a')}`);
	botUser.setActivity({
		name: `since ${moment().format('h:mm a')}`,
		type: 'WATCHING',
	});
});

/**
 * Returns the appropriate command (or null) from specified message content.
 * If there was no exact match, returns the closest command (or null if confidence = 0).
 * If an exact match, confidence is 1.
 *
 * @param {string} messageContent
 * @returns {{command: ?Command, confidence: number}} The found command and confidence
 */
function extractCommand(messageContent: string) {
	const prefix = config.get('options.prefix') as string;

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
	member.roles.add(config.get('new_member_role') as Snowflake);
	const welcomeChannel = await member.guild.channels.fetch(config.get('welcome_channel_id') as Snowflake);
	if (welcomeChannel?.isText()) {
		(welcomeChannel as discord.TextChannel).send(`Welcome to the Spartabots server, ${member}! What's your name?`).catch((error) => {
			Command.debug(`Failed to welcome member ${member}: ${error}`);
		});
	}
});

// list of words meaning roughly hello in various languages
let greetingWords: string[] = [];
async function getGreetings(): Promise<string[]> {
	const GREETINGS_FILE = config.get('greetings_file') as string;
	let data: string[] = [];
	if (GREETINGS_FILE) {
		try {
			data = (await fs.readFile(GREETINGS_FILE, 'utf-8')).split('\n');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
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

	if (command) {
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
					const getgood = message.guild?.emojis.cache.filter((r) => r.name === 'getgood')?.first() || '';
					sent.edit(`Corrected to **${config.get('options.prefix')}${command.name}**. ${getgood}`);
				} else { // ended from timeout
					sent.edit(`:question: Did you mean to use **${config.get('options.prefix')}${command.name}**?`);
				}
			});

			return;
		}
	}

	const cleanContent = message.cleanContent.toLowerCase();
	const messageWords = cleanContent.split(' ');

	if ((messageWords.includes('door') || messageWords.includes('room')) && (messageWords.includes('can') || messageWords.includes('open') || messageWords.includes('lock') || messageWords.includes('locked'))) {
		// ('door' or 'room') and ('can' or 'open' or 'lock' or 'locked')
		message.reply(config.get('automated_message.open_door_message') as string);
	} else if (cleanContent.includes('www.amazon.com')) {
		const newText = message.cleanContent.trim().replace('www.amazon.com', 'smile.amazon.com');
		reply(message, `Consider using a \`smile.amazon.com\` link instead to donate 0.5% to a charity: ${newText} :slight_smile:`);
	}

	const greetingWord = greetingWords.filter((greeting) => cleanContent === greeting || (cleanContent.includes(greeting) && cleanContent.includes(botUser.username.toLowerCase())));

	if (cleanContent.length < 50 && greetingWord.length) {
		const greeting = greetingWord[0][0].toUpperCase() + greetingWord[0].substr(1);
		const name = await getAuthorNickname(message);
		send(message.channel, `${greeting} ${name}`);
	} else if (cleanContent === 'no u' || cleanContent.endsWith(' no u') || cleanContent.includes(' no u ')) {
		if (message.channel.name !== 'general') {
			message.channel.send('no u');
		}
	} else if (Math.random() < 0.0001) { // 0.01% chance
		message.channel.send('Allegedly');
	}
});

const helpCommand = new Command(
	'help',
	"That's this command!",
	'help <optional command>',
	'help tbateam',
	async (message, args) => {
		const optionalArgument = args.toLowerCase().trim();

		const prefix = config.get('options.prefix');

		if (!optionalArgument) { // list every non-hidden command
			if (!message.guild) {
				return;
			}
			const botDisplayName = (await message.guild.members.fetch(botUser.id)).displayName;
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
				if (!command.isHiddenFromHelp) {
					embed.addField(prefix + command.usage, `${command.description}\n__Example__: \`${prefix + command.exampleUsage}\``, false);
				}
			}
			message.channel.send({ embeds: [embed] });
		} else { // there is an argument
			const { command, confidence } = extractCommand(prefix + optionalArgument);
			if (!command || confidence < 0.5) { // not a valid command
				send(message.channel, `Command ${prefix + optionalArgument} does not exist. Try \`${prefix}help\` for a list of commands.`);
			} else {
				// show the command even if it is normally hidden from help
				const embed = new discord.MessageEmbed()
					.setTitle(`Command: ${prefix}${command.name}`)
					.addField('Usage', prefix + command.usage)
					.addField('Description', command.description)
					.addField('Example', prefix + command.exampleUsage);

				message.channel.send({ embeds: [embed] });
			}
		}
	},
);

commands = [
	infoCommand,
	pingCommand,
	whenCommand,
	emojiCommand,
	repeatCommand,

	toggleroleCommand,
	tbateamCommand,

	statCommand,
	evalCommand,
	purgeCommand,
	kysCommand,

	logCommand,
	tophoursCommand,
	correctionsCommand,
	signedinonCommand,
	subtracthoursCommand,
	timestatsCommand,
	attendancecsvCommand,
	preseasonreqsCommand,

	helpCommand,
];

bot.login(config.get('discord_token') as string);
