import { GuildMember, MessageEmbed } from 'discord.js';
import * as moment from 'moment';
import Command from '../command';
import { send, config } from '../util/util';

export default new Command(
	'info',
	'Will give you info about the mentioned member or yourself.',
	'info <optional mentioned member>',
	'info',
	async (message, args) => {
		if (!message.guild) {
			return;
		}

		let member: GuildMember;

		const mentionedMember = message.mentions.members?.first();
		const content = args.trim();
		if (!content && message.member) { // default to author
			member = message.member;
		} else if (mentionedMember) { // mentioned someone
			member = mentionedMember;
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
		let onlineStatus = member.presence?.status ?? 'Unknown';
		if (onlineStatus === 'dnd') {
			onlineStatus = 'do not disturb';
		}

		const dateTimeFormat = 'MMM D, YYYY @ h:mm a';

		const embed = new MessageEmbed()
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
