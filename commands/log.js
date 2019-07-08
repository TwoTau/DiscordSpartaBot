const Command = require("../command");
const LogCommand = require("../logcommand");
const config = require("../config.json");
const signinHelper = require("../signinHelper");

module.exports = new LogCommand(
	"log",
	"Will send the history of your sign-ins and outs.",
	"log <optional name of person>",
	"log",
	function (message, args) {
		if (message.channel.name !== "spam" && message.channel.id !== config.debug_channel_id) {
			const spamChannel = message.guild.channels.find("name", "spam") || "#spam";
			message.reply(`please use ${spamChannel} for bot commands next time.`);
		}

		if (message.member.roles.has(config.new_member_role)) {
			message.reply(`You have the new member role, which means we don't know your name. Change your nickname and then talk to <@!${config.bot_creator}> to add you to the sign in.`);
			return;
		}
		if (message.member.roles.has(config.other_team_role)) {
			message.reply("Only members of our team can use this command.");
			return;
		}
		if (!config.options.enable_log_command) {
			message.channel.send("Everyone's hours have been reset to 0.");
			return;
		}

		const content = args.trim();

		if (content) { // argument is specified
			if ((/^[A-zÀ-ÿ-]+ [A-zÀ-ÿ-]+.*$/).test(content)) { // argument is a name
				const user = signinHelper.doesUserExist(LogCommand.memberNameList, content);
				if (user) { // user exists
					if (Command.isAuthorAdmin(message)) { // admin, so send full data
						signinHelper.sendUserLog(LogCommand.db, message, user.name, user.data.board, "in same channel");
					} else { // not admin, so send only partial data
						signinHelper.sendUserLog(LogCommand.db, message, user.name, user.data.board, false);
					}
				} else { // user does not exist
					message.channel.send(`Sorry, I can't find "**${content}**" in the database. If ${content} **is** a member, talk to <@!${config.bot_creator}> and they'll add it to the sign in.`);
				}
			} else { // argument is not a name
				message.channel.send(`"${content}" should be a full name properly spelled.`);
			}
		} else { // no argument, default to user's own name
			const user = signinHelper.findUserFromDiscordId(LogCommand.memberNameList, message.author.id);
			if (user) { // user is in the database
				signinHelper.sendUserLog(LogCommand.db, message, user.name, user.isBoardMember, "in direct message");
			} else { // not in the database, could be from another team
				message.channel.send(`Sorry, I don't know your full name, ${Command.getAuthorNickname(message)}. If you **are** a club member, you should be in the database, so talk to <@!${config.bot_creator}> and they'll add you to the sign in.`);
			}
		}
	}
);