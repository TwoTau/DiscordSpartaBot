const Command = require("../command");
const config = require("../config.json");
const discord = require("discord.js");
const moment = require("moment");

module.exports = new Command(
	"info",
	"Will give you info about the mentioned member or yourself.",
	"info <optional mentioned member>",
	"info",
	function (message, args) {
		const mentionedMembers = message.mentions.members;
		let member;
		const content = args.trim();
		if (!content) { // default to author
			member = message.member;
		} else if (mentionedMembers.size) { // mentioned someone
			member = mentionedMembers.first();
		} else { // there is content
			const displayNameClean = content.trim().toLowerCase();
			const possibleMember = message.guild.members.find(member => 
				member.displayName.toLowerCase() === displayNameClean);
			
			if (possibleMember) {
				member = possibleMember;
			} else {
				message.channel.send(`I don't think "${content}" is a mentioned user or a username. To mention someone, type @, then select the their name. If you want your own info, do just \`${config.options.prefix}info\`.`);
				return;
			}
		}

		const memberAvatarUrl = member.user.displayAvatarURL;
		const userGame = member.user.presence.game;
		let onlineStatus = member.user.presence.status;
		if (onlineStatus === "dnd") {
			onlineStatus = "Do not disturb";
		} else if (onlineStatus === "idle") {
			onlineStatus = "AFK";
		}

		const dateTimeFormat = "MMM D, YYYY @ h:mm a";

		const embed = new discord.RichEmbed()
			.setAuthor(member.user.tag, memberAvatarUrl)
			.setColor(member.displayColor)
			.setThumbnail(memberAvatarUrl)
			.addField("Nickname", member.displayName, true)
			.addField("ID", member.id, true)
			.addField("Status", onlineStatus, true)
			.addField("Game", (userGame) ? userGame.name : "_none_", true)
			.addField("Account created",
				moment(member.user.createdAt).format(dateTimeFormat), true)
			.addField("Joined server",
				moment(member.joinedAt).format(dateTimeFormat), true)
			.addField("Roles", member.roles.size - 1, true)
			.addField("Highest role", member.highestRole.name, true);

		message.channel.send({ embed });
	}
);