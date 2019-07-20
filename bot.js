/* eslint-disable global-require */
const discord = require('discord.js');
const moment = require('moment');
const Command = require('./command');
const LogCommand = require('./logcommand');
const config = require('./config.json');

const bot = new discord.Client({
	disableEveryone: true,
});

Command.bot = bot;
LogCommand.initialize();
let commands = [];

bot.on('ready', () => {
	bot.user.setActivity(`since ${moment().format('h:mm a')}`, { type: 'WATCHING' });

	Command.debug(`Now online - ${moment().format('M/DD h:mm a')}`);
});

/**
 * Returns the appropriate command (or null) from specified message content
 *
 * @param {string} messageContent
 * @returns {?Command} The found command
 */
function extractCommand(messageContent) {
	const { prefix } = config.options;

	if (!messageContent.startsWith(prefix)) {
		return null;
	}
	const firstWord = messageContent.split(' ')[0].substr(prefix.length).toLowerCase();

	return commands.find(command => firstWord === command.name);
}

bot.on('guildMemberAdd', (member) => {
	member.addRole(config.new_member_role);
	const welcomeChannel = member.guild.channels.find('name', 'general');
	if (welcomeChannel) {
		welcomeChannel.send(`Welcome to the Spartabots server, ${member}! What's your name?`).catch((error) => {
			Command.debug(`Failed to welcome member ${member}: ${error}`);
		});
	}
});

bot.on('message', (message) => {
	const sender = message.author;

	// only respond to real users and on text (non-DM) channels
	if (sender.bot || message.channel.type !== 'text') {
		return;
	}

	const messageContent = message.content.trim();

	const command = extractCommand(messageContent);

	if (command) {
		const spaceCharacterIndex = messageContent.indexOf(' ');
		const args = (spaceCharacterIndex > 0) ? messageContent.substr(spaceCharacterIndex + 1) : '';
		command.execute(message, args);
		return;
	}

	const cleanContent = message.cleanContent.toLowerCase();
	const messageWords = cleanContent.split(' ');

	if ((messageWords.includes('door') || messageWords.includes('room')) && (messageWords.includes('can') || messageWords.includes('open') || messageWords.includes('lock') || messageWords.includes('locked'))) {
		const messageText = config.automated_message.open_door_message;
		message.reply(messageText);
	} else if (cleanContent.includes('www.amazon.com')) {
		const newText = message.cleanContent.trim().replace('www.amazon.com', 'smile.amazon.com');
		message.reply(`Consider using a \`smile.amazon.com\` link instead to donate 0.5% to a charity: ${newText} :slight_smile:`);
	}

	const greetingWord = [
		'hello', 'hi', 'hey', 'hola', 'bonjour', 'ni hao',
		'konnichiwa', 'ohayo', 'hallo', 'halo', '你好', '안녕', 'guten tag',
		'namaste', 'salaam', 'jambo', 'ciao', 'hej', 'aloha', 'नमस्ते', 'salut',
	].filter(greeting => cleanContent === greeting || (cleanContent.includes(greeting) && cleanContent.includes(message.guild.members.find(m => m.id === bot.user.id).displayName.toLowerCase())));

	if (greetingWord.length) {
		const greeting = greetingWord[0][0].toUpperCase() + greetingWord[0].substr(1);
		message.channel.send(`${greeting} ${Command.getAuthorNickname(message)}`);
	} else if (cleanContent === 'no u' || cleanContent.includes(' no u') || cleanContent.includes('no u ')) {
		message.channel.send('no u');
	} else if (Math.random() < 0.0002) { // 0.02% chance
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
	require('./commands/subtracthours'),
	require('./commands/timestats'),
	require('./commands/attendancecsv'),

	{
		name: 'help',
		description: "That's this command!",
		usage: 'help <optional command>',
		exampleUsage: 'help tbateam',
		execute: (message, args) => {
			const optionalArgument = args.toLowerCase().trim();

			const { prefix } = config.options;

			if (!optionalArgument) { // list every non-hidden command
				const botDisplayName = message.guild.members.find(member => member.id === bot.user.id).displayName;
				const githubRepo = config.github_repo;
				const githubUrl = `https://github.com/${githubRepo}`;
				const embed = new discord.RichEmbed()
					.setTitle(`${botDisplayName}'s Command List`)
					.setURL(githubUrl)
					.setColor(0x137CB8)
					.setAuthor(botDisplayName, 'https://www.spartabots.org/images/spartabot-transparent-logo.png')
					.setDescription(`You can find my source code on my [GitHub repo](${githubUrl} "${githubRepo}"). I'm a Discord bot made by <@!${config.bot_creator}> using [discord.js](https://discord.js.org "discord.js home page"). Here's a list of my commands (there are a few hidden ones).`)
					.setFooter(`${prefix}help ${optionalArgument} requested by ${Command.getAuthorNickname(message)}`);

				// adds a field to the embed for each command that is not hidden from help
				for (const command of commands) {
					if (!command.hiddenFromHelp) {
						embed.addField(prefix + command.usage, `${command.description}\n__Example__: \`${prefix + command.exampleUsage}\``, false);
					}
				}
				message.channel.send({ embed });
			} else { // there is an argument
				const optionalCommand = extractCommand(prefix + optionalArgument);
				// show the command even if it is normally hidden from help
				if (optionalCommand) {
					const embed = new discord.RichEmbed()
						.setTitle(`Command: ${prefix}${optionalCommand.name}`)
						.addField('Usage', prefix + optionalCommand.usage)
						.addField('Description', optionalCommand.description)
						.addField('Example', prefix + optionalCommand.exampleUsage);

					message.channel.send({ embed });
				} else { // not a valid command
					message.channel.send(`Command ${prefix + optionalArgument} does not exist. Try \`${prefix}help\` for a list of commands.`);
				}
			}
		},
	},
];

bot.login(config.discord_token);
