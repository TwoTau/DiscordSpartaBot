const LogCommand = require('../logcommand');
const signinHelper = require('../util/signinHelper');
const { send, config, getAuthorNickname, isAuthorAdmin } = require('../util/util');

module.exports = new LogCommand(
	'log',
	'Will send the history of your sign-ins and outs.',
	'log <optional name of person>',
	'log',
	async (message, args) => {
		// send warning if not using spam channel
		if (message.channel.name !== 'spam' && message.channel.id !== config.get('debug_channel_id')) {
			const spamChannel = await message.guild.channels.cache.find((c) => c.name === 'spam');
			if (spamChannel) {
				message.reply(`Please use ${spamChannel} for bot commands next time.`);
			}
		}

		// new member
		if (message.member.roles.cache.has(config.get('new_member_role'))) {
			message.reply(':detective: You have the new member role, which means we don\'t know your name. Change your nickname and talk to a board member to be added to the sign in.');
			return;
		}

		// other team
		if (message.member.roles.cache.has(config.get('other_team_role'))) {
			message.reply(':disguised_face: Only members of our team can use this command.');
			return;
		}

		// sign in disabled
		if (!config.get('options.enable_log_command')) {
			message.channel.send('Everyone\'s hours have been reset to 0.');
			return;
		}

		const content = args.trim();

		if (content) { // argument is specified
			if ((/^[A-zÀ-ÿ-]+ [A-zÀ-ÿ-]+.*$/).test(content)) { // argument is a name
				const user = signinHelper.doesUserExist(LogCommand.memberNameList, content);
				if (user) { // user exists
					if (isAuthorAdmin(message)) { // admin, so send full data
						signinHelper.sendUserLog(LogCommand.db, message, user.name, user.groups, 'in same channel');
					} else { // not admin, so send only partial data
						signinHelper.sendUserLog(LogCommand.db, message, user.name, user.groups, false);
					}
				} else { // user does not exist
					send(message.channel, `:confused: Sorry, I can't find "**${content}**" in the database. If ${content} is a member, talk to a board member and they'll add it to the sign in.`);
				}
			} else { // argument is not a name
				send(message.channel, `"${content}" should be a full name properly spelled.`);
			}
		} else { // no argument, default to user's own name
			const user = signinHelper.findUserFromDiscordId(LogCommand.memberNameList, message.author.id);
			if (user) { // user is in the database
				signinHelper.sendUserLog(LogCommand.db, message, user.name, user.groups, 'in direct message');
			} else { // not in the database, could be from another team
				send(message.channel, `:confused: Sorry, I don't know your full name, ${await getAuthorNickname(message)}. If you're in the club, talk to a board member and they'll add you to the sign in.`);
			}
		}
	},
);
