const discord = require('discord.js');
const LogCommand = require('../logcommand');
const signinHelper = require('../util/signinHelper');
const { config, send, getAuthorNickname, isAuthorAdmin } = require('../util/util');

async function sendReqs(memberName, channel, sendFullData = false) {
	const reqs = (await LogCommand.db.ref(`members/${memberName}/requirements`).once('value')).val();
	if (!reqs) {
		send(channel, `${memberName} has not done the survey. Find it at https://spartabots.org/survey`);
		return;
	}
	const numReqsMet = Object.values(reqs).filter(Boolean).length;
	const numReqs = Object.keys(reqs).length;
	const metReqs = (numReqsMet === numReqs);

	const embed = new discord.MessageEmbed().setColor(metReqs ? 0x04C30E : 0xF62828);

	if (metReqs) {
		embed.setDescription(`${memberName} has met all the requirements!`);
	} else {
		embed.setDescription(`${memberName} has not met ${numReqs - numReqsMet}/${numReqs} requirements.`);
		if (sendFullData) {
			for (const req of Object.keys(reqs)) {
				embed.addField(req, reqs[req] ? 'Met' : 'Unmet', true);
			}
		}
	}

	channel.send({ embeds: [embed] });
}

module.exports = new LogCommand(
	'preseasonreqs',
	'Will tell you whether you met your preseason requirements.',
	'preseasonreqs <optional name of person>',
	'preseasonreqs',
	async (message, args) => {
		if (message.channel.name !== 'spam' && message.channel.id !== config.get('debug_channel_id')) {
			const spamChannel = await message.guild.channels.cache.find((c) => c.name === 'spam');
			if (spamChannel) {
				message.reply(`Please use ${spamChannel} for bot commands next time.`);
			}
		}

		if (message.member.roles.cache.has(config.get('new_member_role'))) {
			message.reply(':detective: You have the new member role, which means we don\'t know your name. Change your nickname and talk to a board member to be added to the sign in.');
			return;
		}
		if (message.member.roles.cache.has(config.get('other_team_role'))) {
			message.reply(':disguised_face: Only members of our team can use this command.');
			return;
		}
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
						sendReqs(user.name, message.channel, true);
					} else { // not admin, so send only partial data
						sendReqs(user.name, message.channel, false);
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
				sendReqs(user.name, message.author, true).then(() => {
					message.channel.send('Check your DMs. I sent you your requirements.');
				});
			} else { // not in the database, could be from another team
				send(message.channel, `:confused: Sorry, I don't know your full name, ${await getAuthorNickname(message)}. If you're in the club, talk to a board member and they'll add you to the sign in.`);
			}
		}
	},
);
