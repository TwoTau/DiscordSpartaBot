const util = require("util");
const config = require("./config.json");
const discord = require("discord.js");
const request = require("request");
const moment = require("moment");
const firebaseAdmin = require("firebase-admin");
const signinHelper = require("./signinHelper");

const bot = new discord.Client({
	disableEveryone: true
});

firebaseAdmin.initializeApp({
	credential: firebaseAdmin.credential.cert(require("./serviceAccountKey.json")),
	databaseURL: config.firebase_db_url
});

const db = firebaseAdmin.database(); // database that contains member sign in and outs
let memberNameList = {};

const BOT_CREATOR_USER_ID = config.bot_creator_user_id;

const PREFIX = config.prefix;

bot.on("ready", () => {
	const time = getTime();
	bot.user.setGame("since " + time);
	bot.user.setAvatar(config.avatar_url).catch(() => {
		console.log("Avatar not set due to rate limits.");
	});

	db.ref("members").once("value", snapshot => {
		memberNameList = snapshot.val();
	});

	debug("Now online - " + time);
});


/**
 * Returns the time in a friendly format
 *
 * @returns {string} Date in M/DD h:mm a format
 */
function getTime() {
	return moment().format("M/DD h:mm a");
}

/**
 * Sends text to the default debug channel, if it exists
 *
 * @param {string} text
 * @returns {?Promise} Sending the message resolves with success or failure
 */
function debug(text) {
	console.log(text);
	const debugChannel = bot.channels.get(config.debug_channel_id);
	if(debugChannel) {
		return debugChannel.send(text);
	}
}

/**
 * Checks whether the author of the message is the bot creator, as defined in the config
 *
 * @param {Message} message
 * @returns {boolean}
 */
function isAuthorBotCreator(message) {
	return message.author.id === BOT_CREATOR_USER_ID;
}

/**
 * Checks whether the author of the message has the admin role or is the bot creator
 *
 * @param {Message} message
 * @returns {boolean}
 */
function isAuthorAdmin(message) {
	const adminRole = message.guild.roles.find("name", config.admin_role);
	return !adminRole || message.member.roles.has(adminRole.id) || isAuthorBotCreator(message);
}

/**
 * Returns the display name or nickname of the message's author
 *
 * @param {Message} message
 * @returns {string} The author's display name, or if not available, the author's nickname
 */
function getAuthorNickname(message) {
	if(message.member) {
		return message.member.displayName;
	}
	const nickname = message.guild.members.get(message.author.id).nickname;
	return nickname ? nickname : message.author.username;
}

/**
 * Returns the member with the specified display name in the message's server
 *
 * @param {Guild} server - the Discord server
 * @param {string} displayName - Case-insensitive string
 * @returns {?GuildMember} The member with the display name
 */
function getMember(server, displayName) {
	const displayNameClean = displayName.trim().toLowerCase();
	return server.members.find(member => member.displayName.toLowerCase() === displayNameClean);
}

/**
 * Returns the appropriate command (or null) from specified message content
 *
 * @param {string} messageContent
 * @returns {?Object} The found command
 */
function extractCommand(messageContent) {
	if(!messageContent.startsWith(PREFIX)) {
		return null;
	}
	const firstWord = messageContent.split(" ")[0].substr(PREFIX.length).toLowerCase();

	return commands.find(command => {
		return firstWord === command.name;
	});
}

bot.on("guildMemberAdd", member => {
	member.addRole(config.new_member_role);
	member.guild.defaultChannel.send(`Welcome to the Spartabots server, ${member}! What's your name?`);
});

bot.on("message", message => {
	const sender = message.author;

	// will only respond to real users and on text (non-DM) channels
	if(!sender.bot && message.channel.type === "text") {
		const messageContent = message.content.trim();

		const command = extractCommand(messageContent);

		if(command) {
			const spaceCharacterIndex = messageContent.indexOf(" ");
			const args = (spaceCharacterIndex > 0) ? messageContent.substr(spaceCharacterIndex + 1) : "";
			command.execute(message, args);

		} else {
			const messageWords = message.cleanContent.toLowerCase().split(" ");

			if(["hello", "hi", "hey", "hola", "bonjour"].some(greeting => messageWords.includes(greeting))) {
				message.channel.send(`Hi ${getAuthorNickname(message)}`);
			} else if(message.content.includes("?")) {
				if(Math.random() < 0.02) { // 2% chance
					message.channel.send("Don't worry about it");
				}
			} else if((/^[a-zÀ-ÿ-]+ is [a-zÀ-ÿ-]+.?$/).test(message.cleanContent.toLowerCase()) && !["who", "what", "where", "when", "how", "why"].some(questionWord => messageWords.includes(questionWord))) {
				message.channel.send("It is known.");
			} else if(Math.random() < 0.005) {
				message.channel.send("Allegedly");
			} else if(Math.random() < 0.005) { // Mocking spongebob meme
				// Alternates the case of the message's content
				const chars = message.cleanContent.toLowerCase().split("");
				for(let i = 0; i < chars.length; i += (Math.random() < 0.2) ? 1 : 2) {
					if(chars[i] === " " && Math.random() < 0.7) {
						++i;
					}
					chars[i] = chars[i].toUpperCase();
				}

				message.channel.send(chars.join(""), {
					files: ["spongebob.jpg"]
				});
			}
		}
	}
});

const commands = [
	{
		name: "info",
		description: "Will give you info about the mentioned member or yourself.",
		usage: "info <optional mentioned member>",
		exampleUsage: "info",
		execute: function(message, content) {
			const mentionedMembers = message.mentions.members;
			let member;
			if(!content) { // default to author
				member = message.member;
			} else if(mentionedMembers.size) { // mentioned someone
				member = mentionedMembers.first();
			} else { // there is content
				const possibleMember = getMember(message.guild, content);
				if(possibleMember) {
					member = possibleMember;
				} else {
					message.channel.send(`"${content}" is neither a mentioned user nor a username. To mention someone, type @, then select the member's name. If you want your own info, try just \`${PREFIX}info\`.`);
					return;
				}
			}

			const memberAvatarUrl = member.user.displayAvatarURL;
			const userGame = member.user.presence.game;
			let onlineStatus = member.user.presence.status;
			if(onlineStatus === "dnd") {
				onlineStatus = "Do not disturb";
			} else if(onlineStatus === "idle") {
				onlineStatus = "AFK";
			}

			const dateTimeFormat = "MMM D, YYYY @ h:mm a";

			const embed = new discord.RichEmbed()
			.setAuthor(member.user.tag, memberAvatarUrl)
			.setColor(member.displayColor)
			.setThumbnail(memberAvatarUrl)
			.addField("Nickname", member.displayName, true)
			.addField("ID", member.id, true)
			.addField("Online status", onlineStatus, true)
			.addField("Game", (userGame) ? userGame.name : "_none_", true)
			.addField("Account created", moment(member.user.createdAt).format(dateTimeFormat), true)
			.addField("Joined server", moment(member.joinedAt).format(dateTimeFormat), true)
			.addField("Roles", member.roles.size - 1, true)
			.addField("Highest role", member.highestRole.name, true)
			.setFooter(`${PREFIX}info requested by ${getAuthorNickname(message)}`);

			message.channel.send({embed});
		}
	},

	{
		name: "repeat",
		description: "Will repeat your message then delete it.",
		usage: "repeat <text>",
		exampleUsage: "repeat I am a good bot",
		hiddenFromHelp: true,
		execute: function(message, args) {
			message.channel.send(args);
			message.delete();
		}
	},

	{
		name: "togglerole",
		description: `Will give or take away a role from you. The argument must be one of these: ${Object.keys(config.toggleable_roles).join(", ")}.`,
		usage: "togglerole <role name>",
		exampleUsage: "togglerole strategy",
		execute: function(message, content) {
			const allowedRoles = Object.keys(config.toggleable_roles);
			const allowedRolesAsList = "_" + allowedRoles.join("_, _") + "_"; // each of the roles is italicized

			if(!content) {
				message.channel.send(`You must specify an argument in this list: ${allowedRolesAsList}.`);
				return;
			}

			const args = content.toLowerCase();

			if(!allowedRoles.includes(args)) {
				message.channel.send(`"${content}" must in this list: ${allowedRolesAsList}.`);
				return;
			}

			const roleId = config.toggleable_roles[args];
			const authorNickname = getAuthorNickname(message);
			if(message.member.roles.has(roleId)) { // already has the role
				message.member.removeRole(roleId).then(() => {
					message.channel.send(`Removed ${args}.`);
				}).catch(() => {
					debug(`Error: could not remove user ${authorNickname} from the role ${args}.`);
					message.channel.send("Sorry, there was an error trying to remove you from the role.");
				});
			} else { // does not already have the role
				message.member.addRole(roleId).then(() => {
					message.channel.send(`Gave you ${args}.`);
				}).catch(() => {
					debug(`Error: could not give user ${authorNickname} the role ${args}.`);
					message.channel.send("Sorry, there was an error trying to give you the role.");
				});
			}
		}
	},

	{
		name: "eval",
		description: "Executes <:js:344173602112798730> in a very unsafe manner. Can only be used by the bot creator.",
		usage: "just don't",
		exampleUsage: ":regional_indicator_n: :o2:",
		hiddenFromHelp: true,
		execute: function(message, content) {
			if(!(isAuthorBotCreator(message) && config.allow_eval_command)) {
				message.channel.send(":expressionless: :regional_indicator_n: :o2: :unamused:");
				return;
			}

			try {
				let evaled = eval(content);
				if(typeof(evaled) !== "string") {
					evaled = util.inspect(evaled);
				}
				if(typeof(evaled) === "string") {
					evaled = evaled.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
				}
				evaled = evaled.substring(0, 1950);
				message.channel.send(evaled, {code: "xl"}).catch(() => {
					debug("Eval result was empty");
				});
			} catch(error) {
				let errText = error;
				if(typeof(error) === "string") {
					errText = error.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
				}
				message.channel.send("`ERROR` ```xl\n" + errText + "\n```");
			}
		}
	},

	{
		name: "purge",
		description: "Will delete the past _n_ comments. This command can only be used by admins.",
		usage: "purge <number of messages n where n ∈ ℤ ∩ [1,100]>",
		exampleUsage: "purge 5",
		execute: function(message, args) {
			if(!isAuthorAdmin(message)) {
				message.channel.send("You are not authorized to purge messages");
				return;
			}

			if(!args) {
				message.channel.send("Number of messages to purge was not specified. No messages will be cleared.");
				return;
			}

			const contentAsNumber = parseInt(args, 10);

			if(!isNaN(contentAsNumber) && contentAsNumber > 0 && contentAsNumber < 101) { // parameter is valid
				message.channel.fetchMessages({ limit: contentAsNumber }).then(results => {
					for (const messageToDelete of results) {
						messageToDelete[1].delete();
					}
				});

				const dystopianQuotes = [
					"It was a pleasure to burn.",
					"Memory is an illusion, nothing more. It is a fire that needs constant tending.",
					"It's a beautiful thing, the destruction of words.",
					"Ignorance is strength.",
					"We, the Party, control all records, and we control all memories. Then we control the past, do we not?",
					"The most effective way to destroy people is to deny and obliterate their own understanding of their history.",
					"History has stopped. Nothing exists except an endless present in which the Party is always right."
				];

				const dystopianQuote = dystopianQuotes[Math.floor(Math.random() * dystopianQuotes.length)];

				message.channel.send(`**${getAuthorNickname(message)} deleted ${contentAsNumber} messages.**`);
				message.channel.send(`_"${dystopianQuote}"_`);
			} else {
				message.channel.send(`${args} is not an integer between 1-100. No messages will be cleared.`);
			}
		}
	},

	{
		name: "log",
		description: "Will send the history of your sign-ins and outs.",
		usage: "log <optional name of person>",
		exampleUsage: "log",
		execute: function(message, content) {
			if(content) { // argument is specified
				if((/^[A-zÀ-ÿ-]+ [A-zÀ-ÿ-]+.*$/).test(content)) { // argument is a name
					const user = signinHelper.doesUserExist(memberNameList, content);
					if(user) { // user exists
						if(isAuthorAdmin(message)) { // admin, so send full data
							signinHelper.sendUserLog(db, message, user.name, user.data.board, "in same channel");
						} else { // not admin, so send only partial data
							signinHelper.sendUserLog(db, message, user.name, user.data.board, false);
						}
					} else { // user does not exist
						message.channel.send(`Sorry, I can't find "**${content}**" in the database. If ${content} **is** a member, talk to <@!${BOT_CREATOR_USER_ID}> and they'll add it to the sign in.`);
					}
				} else { // argument is not a name
					message.channel.send(`"${content}" should be a full name properly spelled.`);
				}
			} else { // no argument, default to user's own name
				const user = signinHelper.findUserFromDiscordId(memberNameList, message.author.id);
				if(user) { // user is in the database
					signinHelper.sendUserLog(db, message, user.name, user.isBoardMember, "in direct message");
				} else { // not in the database, could be from another team
					message.channel.send(`Sorry, I don't know your full name, ${getAuthorNickname(message)}. If you **are** a club member, you should be in the database, so talk to <@!${BOT_CREATOR_USER_ID}> and they'll add you to the sign in.`);
				}
			}
		}
	},

	{
		name: "tbateam",
		description: "Will give you information about a team given the team number.",
		usage: "tbateam <teamnumber t where t ∈ ℤ ∩ [1,6801]>",
		exampleUsage: "tbateam 2976",
		execute: function(message, content) {
			if(!content) { // no parameter
				message.channel.send("You need to specify a team number (1-6771).");
				return;
			}

			if(+content > 0 && +content < 6771) { // parameter is valid
				// send a request to TheBlueAlliance's API for team information
				request({
					url: `http://www.thebluealliance.com/api/v3/team/frc${+content}?X-TBA-Auth-Key=${config.tba_auth_key}`,
					json: true
				}, function(error, response, body) {
					if(response.statusCode === 404) { // page could not be found, so the team does not exist
						message.channel.send(`Team ${+content } doesn't exist.`);
						return;
					}

					if(error || response.statusCode !== 200) { // did not receive an OK status code
						message.channel.send("Something went wrong with using TheBlueAlliance's API");
						return;
					}

					const motto = body.motto ? `"${body.motto}"` : "_none_";
					const location = body.city ? `${body.city}, ${body.state_prov}` : "unknown";
					const nickname = body.nickname || "";

					const embed = new discord.RichEmbed()
						.setTitle(`FRC Team ${body.team_number}: ${nickname}`)
						.setURL(`https://www.thebluealliance.com/team/${body.team_number}`)
						.setColor(0x12C40F)
						.addField("Team number", body.team_number, true)
						.addField("Nickname", nickname, true)
						.addField("Location", location, true)
						.addField("Motto", motto, true)
						.addField("Website", body.website || "_none_", true)
						.setFooter(`${PREFIX}tbateam ${content} requested by ${getAuthorNickname(message)}`);

					message.channel.send({embed});
				});
			} else { // parameter is not valid
				message.channel.send(`${content} is not a number between 1-6771.`);
			}
		}
	},

	{
		name: "kys",
		description: "Restarts this program. Can only be used by the bot creator.",
		usage: "kys",
		exampleUsage: "kys",
		hiddenFromHelp: true,
		execute: function(message) {
			// disallow killing this program by anyone but the bot creator
			if(!isAuthorBotCreator(message)) {
				message.channel.send(":angry: :regional_indicator_n: :o2: :rage:");
				return;
			}

			message.channel.send(":scream: Shutting down :skull:").then(() => {
				console.log(`Shutdown on ${getTime()} by ${getAuthorNickname(message)}.`);
				bot.destroy().then(() => {
					process.exit();
				});
			});
		}
	},

	{
		name: "help",
		description: "That's this command!",
		usage: "help <optional command>",
		exampleUsage: "help tbateam",
		execute: function(message, args) {
			const optionalArgument = args.toLowerCase();

			if(!optionalArgument) { // list every non-hidden command
				const botDisplayName = message.guild.members.find(member => member.id === bot.user.id).displayName;
				const githubRepo = config.github_repo;
				const githubUrl = "https://github.com/" + githubRepo;
				const embed = new discord.RichEmbed()
					.setTitle(botDisplayName + "'s Command List")
					.setURL(githubUrl)
					.setColor(0x137CB8)
					.setAuthor(botDisplayName, "https://www.spartabots.org/images/spartabot-transparent-logo.png")
					.setDescription(`You can find my source code on my [GitHub repo](${githubUrl} "${githubRepo}"). I'm a Discord bot made by <@!${BOT_CREATOR_USER_ID}> using [discord.js](https://discord.js.org "discord.js home page"). Here's a list of my commands (there are a few hidden ones).`)
					.setFooter(`${PREFIX}help ${optionalArgument} requested by ${getAuthorNickname(message)}`);

				// adds a field to the embed for each command that is not hidden from help
				for(const command of commands) {
					if(!command.hiddenFromHelp) {
						embed.addField(PREFIX + command.usage, `${command.description}\n__Example__: \`${PREFIX}${command.exampleUsage}\``, false);
					}
				}
				message.channel.send({embed});
			} else { // there is an argument
				const optionalCommand = extractCommand(PREFIX + optionalArgument);
				if(optionalCommand) { // show the command even if it is normally hidden from help
					const embed = new discord.RichEmbed()
						.setTitle("Command: " + PREFIX + optionalCommand.name)
						.addField("Usage", PREFIX + optionalCommand.usage)
						.addField("Description", optionalCommand.description)
						.addField("Example", PREFIX + optionalCommand.exampleUsage);

					message.channel.send({embed});
				} else { // not a valid command
					message.channel.send(`Command ${PREFIX}${optionalArgument} does not exist. Try \`${PREFIX}help\` for a list of commands.`);
				}
			}
		}
	}
];

bot.login(config.discord_token);
