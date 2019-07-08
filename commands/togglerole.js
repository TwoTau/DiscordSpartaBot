const Command = require("../command");
const config = require("../config.json");

module.exports = new Command(
	"togglerole",
	`Will give or take away a role from you. Does not work in the #general channel. The argument must be one of these: ${Object.keys(config.toggleable_roles).join(", ")}.`,
	"togglerole <role name>",
	"togglerole strategy",
	function (message, content) {
		const allowedRoles = Object.keys(config.toggleable_roles);
		// Italicize each of the roles
		const allowedRolesAsList = "_" + allowedRoles.join("_, _") + "_";

		if (message.channel.name === "general") {
			const spamChannel = message.guild.channels.find("name", "spam") || "#spam";
			message.channel.send(`Use ${spamChannel} for bot commands.`);
			return;
		}

		if (!content) {
			message.channel.send(`You must specify an argument in this list: ${allowedRolesAsList}.`);
			return;
		}

		const args = content.toLowerCase().trim();

		if (!allowedRoles.includes(args)) {
			message.channel.send(`"${content}" isn't a toggleable role. This is the list of roles you can toggle: ${allowedRolesAsList}.`);
			return;
		}

		const roleId = config.toggleable_roles[args];
		const authorNickname = Command.getAuthorNickname(message);
		if (message.member.roles.has(roleId)) { // already has the role
			message.member.removeRole(roleId).then(() => {
				message.channel.send(`Removed ${args}.`);
			}).catch(() => {
				Command.debug(`Error: could not remove user ${authorNickname} from the role ${args}.`);
				message.channel.send("Sorry, there was an error trying to remove you from the role.");
			});
		} else { // does not already have the role
			// do not allow newly joined users or non-team members to add roles
			if (message.member.roles.has(config.new_member_role) ||
				message.member.roles.has(config.other_team_role)) {
				message.channel.send(`You have to be a member of our club/server to use ${config.options.prefix}togglerole. Ask <@!${config.bot_creator}> or someone with the board role to give you any roles.`);
				return;
			}

			message.member.addRole(roleId).then(() => {
				message.channel.send(`Gave you ${args}.`);
			}).catch(() => {
				Command.debug(`Error: could not give user ${authorNickname} the role ${args}.`);
				message.channel.send("Sorry, there was an error trying to give you the role.");
			});
		}
	}
);