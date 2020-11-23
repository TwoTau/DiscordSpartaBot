const Command = require('../command');
const { config, send, getAuthorNickname } = require('../util/util');

module.exports = new Command(
	'togglerole',
	`Will give or take away a role from you. Does not work in the #general channel. The argument must be one of these: ${Object.keys(config.get('toggleable_roles')).join(', ')}.`,
	'togglerole <role name>',
	'togglerole strategy',
	async (message, content) => {
		const allowedRoles = Object.keys(config.get('toggleable_roles'));
		// Italicize each of the roles
		const allowedRolesAsList = `_${allowedRoles.join('_, _')}_`;

		if (message.channel.name !== 'spam' && message.channel.id !== config.get('debug_channel_id')) {
			const spamChannel = await message.guild.channels.cache.find((c) => c.name === 'spam');
			if (spamChannel) {
				message.reply(`Use ${spamChannel} for bot commands.`);
				return;
			}
		}

		if (!content) {
			send(message.channel, `These are the roles you can toggle: ${allowedRolesAsList}.`);
			return;
		}

		const args = content.toLowerCase().trim();

		if (!allowedRoles.includes(args)) {
			send(message.channel, `"${content}" isn't a toggleable role. You can toggle these roles: ${allowedRolesAsList}.`);
			return;
		}

		const roleId = config.get('toggleable_roles')[args];
		const authorNickname = await getAuthorNickname(message);

		if (message.member.roles.cache.has(roleId)) { // already has the role
			try {
				await message.member.roles.remove(roleId, 'Toggled role');
				send(message.channel, `Removed ${args}.`);
			} catch (error) {
				await Command.debug(`Error: could not remove ${authorNickname} from the role ${args}. Error: ${error}`);
				message.channel.send('Sorry, there was an error trying to remove you from the role.');
			}
		} else { // does not already have the role
			const isNewMember = message.member.roles.cache.has(config.get('new_member_role'));
			const isOtherTeam = message.member.roles.cache.has(config.get('other_team_role'));

			// do not allow newly joined users or non-team members to add roles
			if (isNewMember || isOtherTeam) {
				send(message.channel, `You have to be a member of our club/server to use ${config.get('options.prefix')}togglerole. Ask someone with the board role to give you any roles.`);
				return;
			}

			try {
				await message.member.roles.add(roleId, 'Toggled role');
				send(message.channel, `Gave you ${args}.`);
			} catch (error) {
				Command.debug(`Error: could not give ${authorNickname} the role ${args}. Error: ${error}`);
				message.channel.send('Sorry, there was an error trying to give you the role.');
			}
		}
	},
);
