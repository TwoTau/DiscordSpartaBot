const discord = require('discord.js');
const moment = require('moment');
const Command = require('../command');
const { send, config } = require('../util/util');

module.exports = new Command(
	'info',
	'Will give you info about the mentioned member or yourself.',
	'info <optional mentioned member>',
	'info',
	async (message, args) => {
		const mentionedMembers = message.mentions.members;
		let member;
		const content = args.trim();
		if (!content) { // default to author
			({ member } = message);
		} else if (mentionedMembers.size) { // mentioned someone
			member = mentionedMembers.first();
		} else { // there is content
			const displayNameClean = content.trim().toLowerCase();
			const possibleMember = (await message.guild.members.fetch({
				query: displayNameClean,
				limit: 1,
			})).first();

			if (possibleMember) {
				member = possibleMember;
			} else {
				send(message.channel, `I don't think "${content}" is a mentioned user or a username. To mention someone, type @ and select their name. For your own info, try \`${config.get('options.prefix')}info\`.`);
				return;
			}
		}

		const memberAvatarUrl = member.user.displayAvatarURL();
		let onlineStatus = member.user.presence?.status ?? 'Unknown';
		if (onlineStatus === 'dnd') {
			onlineStatus = 'Do not disturb';
		} else if (onlineStatus === 'idle') {
			onlineStatus = 'AFK';
		}

		const dateTimeFormat = 'MMM D, YYYY @ h:mm a';

		const embed = new discord.MessageEmbed()
			.setAuthor(member.user.tag, memberAvatarUrl)
			.setThumbnail(memberAvatarUrl)
			.addField('Nickname', member.displayName, true)
			.addField('ID', member.id, true)
			.addField('Status', onlineStatus, true)
			.addField('Account created',
				moment(member.user.createdAt).format(dateTimeFormat), true)
			.addField('Joined server',
				moment(member.joinedAt).format(dateTimeFormat), true)
			.addField('Roles', (member.roles.cache.size - 1).toString(), true)
			.addField('Highest role', member.roles.highest.name, true);

		if (member.displayColor) {
			embed.setColor(member.displayColor);
		}

		message.channel.send({ embeds: [embed] });
	},
);
