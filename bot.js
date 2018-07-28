const util = require("util");
const config = require("./config.json");
const discord = require("discord.js");
const request = require("request");
const moment = require("moment");
const ytdl = require("ytdl-core");
const ytsearch = require("youtube-search");
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

const BOT_CREATOR = config.bot_creator;

const PREFIX = config.options.prefix;

const GET_TIME_FORMAT = "M/DD h:mm a";

const queue = [];
let playing = false;

bot.on("ready", () => {
	const time = getTime();
	// bot.user.setActivity("since " + moment().format("h:mm a"), {type: "WATCHING"});
	bot.user.setActivity("since " + moment().format("h:mm a"), {type: "WATCHING"});

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
	return moment().format(GET_TIME_FORMAT);
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
	return message.author.id === BOT_CREATOR;
}

/**
 * Checks whether the author of the message has the admin role or is the bot creator
 *
 * @param {Message} message
 * @returns {boolean}
 */
function isAuthorAdmin(message) {
	return message.member.roles.has(config.admin_role) || isAuthorBotCreator(message);
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
 * Returns the first member with the specified display name in the message's server
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

/**
 * Converts seconds into h:mm:ss or m:ss format
 * 
 * @param {Number} seconds - integer
 * @return {string} The formatted time
 */
function formatSecondsAsTime(seconds) {
	const hours = Math.floor(seconds / 3600);
	let minutes = Math.floor((seconds % 3600) / 60);
	let secs = seconds % 60;
	if(secs < 10) {
		secs = "0" + secs;
	}
	if(seconds < 3600) {
		return minutes + ":" + secs;
	}
	if(minutes < 10) {
		minutes = "0" + minutes;
	}
	return hours +":" + minutes + ":" + secs;
}

/**
 * Adds a song's information to the queue
 *
 * @param {Object} info - the object that ytdl returns
 * @param {string} videoTitle
 * @param {string} youtubeUrl
 * @param {Number} videoDuration - the video's duration in seconds (integer)
 * @param {Message} message - the message that sent the queue request
 * @returns {void}
 */
function sendAddQueueMessage(info, videoTitle, youtubeUrl, videoDuration, message) {
	const uploaderName = info.author.name || "???";
	const uploaderAvatar = info.author.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
	const publishDate = moment(info.published).format("LL") || "???";
	const avgRating = Math.round(info.avg_rating * 10)/10 || "???";
	const thumbnail = info.thumbnail_url;
	
	const embed = new discord.RichEmbed()
		.setColor(0x12C40F)
		.setAuthor(uploaderName, uploaderAvatar)
		.setTitle(videoTitle)
		.setURL(youtubeUrl)
		.addField("Published", publishDate, true)
		.addField("Rating", avgRating, true)
		.addField("Duration", formatSecondsAsTime(videoDuration), true)
		.addField("Queue Position", "#" + queue.length, true)
		.setFooter(`Requested by ${message.member.displayName || "???"} on ${getTime()}.`);
	
	if(thumbnail) {
		embed.setThumbnail(thumbnail);
	}
	message.channel.send({embed});
}

/**
 * Sends the current playing song in the specified channel
 *
 * @param {TextChannel} mChannel - the channel to send in
 * @returns {void}
 */
function sendPlayingSongInfo(mChannel) {
	if(!playing) {
		return;
	}
	const playingSong = playing;
	
	const embed = new discord.RichEmbed()
		.setColor(0x12C40F)
		.addField("Now playing " + playingSong.title, `(${formatSecondsAsTime(playingSong.duration)}) requested by ${playingSong.requester.displayName} at ${playingSong.timeRequested}. ([Link](${playingSong.url}))`, true);
	mChannel.send({embed});
}

/**
 * Plays through the queue
 *
 * @param {TextChannel} mChannel - the channel to listen for song commands in
 * @param {Object} queueItem - an item of the queue list with a song's information
 * @returns {void}
 */
function play(mChannel, queueItem) {
	const voiceChannel = mChannel.guild.me.voiceChannel;
	if(!voiceChannel) {
		mChannel.send(`I must be in a voice channel before I can play anything. Type ${PREFIX}connect to get me to join your voice channel.`);
		playing = false;
		return;
	}
	if(!voiceChannel.speakable) {
		mChannel.send(`I don't have permission to speak in this voice channel ${voiceChannel.name}.`);
		playing = false;
		return;
	}
	if(!voiceChannel.connection) {
		mChannel.send(`Please type \`${PREFIX}disconnect\` then \`${PREFIX}connect\` again.`);
		return;
	}
	
	if(!queueItem) {
		mChannel.send(`The queue is empty :(. Add something with \`${PREFIX}addq <search terms>\` then do \`${PREFIX}play\`.`);
		playing = false;
		return;
	}
	
	playing = queueItem;
	sendPlayingSongInfo(mChannel);

	const queueItemTitle = queueItem.title;
	const queueItemUrl = queueItem.url;
	
	const ytAudioStream = ytdl(queueItemUrl, {audioonly: true});
	const dispatcher = voiceChannel.connection.playStream(ytAudioStream, {passes: config.options.audio_playback_passes});
	
	const collector = mChannel.createCollector(m => m);
	collector.on("collect", message => {
		const content = message.cleanContent.toLowerCase();
		if(!content.startsWith(PREFIX)) {
			return;
		}
		const command = content.substr(PREFIX.length);
		if(command.startsWith("pause")) {
			mChannel.send("Paused " + queueItemTitle).then(() => {	
				dispatcher.pause();
			});
		} else if(command.startsWith("resume")) {
			mChannel.send("Resumed " + queueItemTitle).then(() => {
				dispatcher.resume();
			});
		} else if(command.startsWith("skip")) {
			mChannel.send("Skipped " + queueItemTitle).then(() => {
				dispatcher.end();
			});
		} else if(command.startsWith("loop")) {
			mChannel.send("Adding this as next item in queue: " + queueItemTitle).then(() => {
				queue.unshift(queueItem);
			});
		} else if(command.startsWith("time")) {
			mChannel.send(`I've been playing this for: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
		}
	});
	
	dispatcher.on("end", () => {
		collector.stop();
		play(mChannel, queue.shift());
	});
}

bot.on("guildMemberAdd", member => {
	member.addRole(config.new_member_role);
	const welcomeChannel = member.guild.channels.find("name", "general");
	const spamChannel = member.guild.channels.find("name", "spam") || "#spam";
	if(!welcomeChannel) {
		return;
	}
	welcomeChannel.send(`Welcome to the Spartabots server, ${member}! What's your name? To add roles to yourself, type \`!togglerole\` in ${spamChannel}.`).catch(error => {
		debug("Failed to welcome member " + member + ": " + error);
	});
});

// deletes automated message if reacted to with delete emoji
bot.on("messageReactionAdd", (messageReaction) => {
	const message = messageReaction.message;
	const content = message.cleanContent.toLowerCase();
	const isAuthorBot = message.author.id === bot.user.id;
	const isMessageAutomated = content.includes("this is an automated message") || content.includes("it is known");
	const isReactionDeleteEmoji = messageReaction.emoji.id === config.automated_message.delete_emoji;
	if(isAuthorBot && isMessageAutomated && isReactionDeleteEmoji) {
		message.delete();
	}
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
			const cleanContent = message.cleanContent.toLowerCase();
			const messageWords = cleanContent.split(" ");
			
			if((messageWords.includes("door") || messageWords.includes("room")) && (messageWords.includes("can") || messageWords.includes("open") || messageWords.includes("lock") || messageWords.includes("locked"))) {
				const messageText = config.automated_message.open_door_message;
				const deleteEmoji = message.guild.emojis.find("id", config.automated_message.delete_emoji) || "?";
				message.reply(`${messageText} _React with_ ${deleteEmoji} _to delete this message._`);
			}

			const greetingWord = ["hello", "hi", "hey", "hola", "bonjour", "ni hao", "konnichiwa", "ohayo", "hallo", "halo", "你好", "guten tag", "namaste", "salaam", "jambo", "ciao", "hej", "aloha","नमस्ते", "salut"].filter(greeting => cleanContent === greeting || (cleanContent.includes(greeting) && cleanContent.includes(message.guild.members.find(m=>m.id === bot.user.id).displayName.toLowerCase())));

			if(greetingWord.length) {
				const greeting = greetingWord[0][0].toUpperCase() + greetingWord[0].substr(1);
				message.channel.send(`${greeting} ${getAuthorNickname(message)}`);
			} else if(message.content.includes("?")) {
				if(Math.random() < 0.01) { // 1% chance
					message.channel.send("Don't worry about it");
				}
			} else if(cleanContent === "no u" || cleanContent.includes(" no u") || cleanContent.includes("no u ")) {
				message.channel.send("no u");
			} else if(cleanContent.includes(" is ") && !["who", "what", "wat", "wut", "wot", "where", "when", "how", "why", "y"].some(questionWord => messageWords.includes(questionWord)) && cleanContent.length < 50) {
				// if channel is in the spam category
				if(message.channel.parent && message.channel.parent.name.toLowerCase() === "spam") {
					message.channel.send("It is known.");
				}
			} else if(Math.random() < 0.0002) { // 0.02% chance
				message.channel.send("Allegedly");
			}
			
			// automatically react to certain key words
			if(messageWords.includes("communism") || messageWords.includes("communist")) {
				message.react(message.guild.emojis.find("name","communism"));
			} else if(messageWords.includes("safety") || messageWords.includes("glasses")) {
				message.react(message.guild.emojis.find("name","safety"));
			} else if(messageWords.includes("salt") || messageWords.includes("salty") || messageWords.includes("nacl")) {
				message.react(message.guild.emojis.find("name","salt"));
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
		execute: function(message, args) {
			const mentionedMembers = message.mentions.members;
			let member;
			const content = args.trim();
			if(!content) { // default to author
				member = message.member;
			} else if(mentionedMembers.size) { // mentioned someone
				member = mentionedMembers.first();
			} else { // there is content
				const possibleMember = getMember(message.guild, content);
				if(possibleMember) {
					member = possibleMember;
				} else {
					message.channel.send(`I don't think "${content}" is a mentioned user or a username. To mention someone, type @, then select the their name. If you want your own info, try just \`${PREFIX}info\`.`);
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
			.addField("Status", onlineStatus, true)
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
		execute: function(message, content) {
			message.channel.send(content);
			message.delete();
		}
	},

	{
		name: "when",
		description: `Will tell you how much time there is until an event. Argument must be one of these: ${Object.keys(config.toggleable_roles).join(", ")}.`,
		usage: "when <event name>",
		exampleUsage: "when stopbuild",
		hiddenFromHelp: false,
		execute: function(message, content) {
			const allowedEventNames = Object.keys(config.events);
			const allowedEventNamesAsList = "_" + allowedEventNames.join("_, _") + "_";

			if(!content) {
				message.channel.send(`You must specify an argument in this list: ${allowedEventNamesAsList}.`);
				return;
			}

			const args = content.toLowerCase().trim();
			if(!allowedEventNames.includes(args)) {
				message.channel.send(`"${content}" must in this list: ${allowedEventNamesAsList}.`);
				return;
			}

			const eventName = config.events[args].name;
			const timestamp = config.events[args].timestamp;

			const seconds = moment(timestamp).diff(moment(), "seconds");
			const absMin = Math.abs(seconds/60);
			const tillOrSince = (seconds > 0) ? "till" : "since";

			const embed = new discord.RichEmbed()
			.setColor(0x0ac12c)
				.addField(`Time ${tillOrSince} ${eventName}`, `${Math.round(absMin)} minutes = ${Math.round(absMin / 60)} hours = **${Math.round(absMin/144)/10} days**`, true);

			message.channel.send({embed});
		}
	},

	{
		name: "togglerole",
		description: `Will give or take away a role from you. Does not work in the #general channel. The argument must be one of these: ${Object.keys(config.toggleable_roles).join(", ")}.`,
		usage: "togglerole <role name>",
		exampleUsage: "togglerole strategy",
		execute: function(message, content) {
			const allowedRoles = Object.keys(config.toggleable_roles);
			// Italicize each of the roles
			const allowedRolesAsList = "_" + allowedRoles.join("_, _") + "_";

			if(message.channel.name === "general") {
				const spamChannel = message.guild.channels.find("name", "spam") || "#spam";
				message.channel.send(`Use ${spamChannel} for bot commands.`);
				return;
			}

			if(!content) {
				message.channel.send(`You must specify an argument in this list: ${allowedRolesAsList}.`);
				return;
			}

			const args = content.toLowerCase().trim();

			if(!allowedRoles.includes(args)) {
				message.channel.send(`"${content}" isn't a toggleable role. This is the list of roles you can toggle: ${allowedRolesAsList}.`);
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
				// do not allow users that just joined the server or are not team members to add roles
				if(message.member.roles.has(config.new_member_role) || message.member.roles.has(config.other_team_role)) {
					message.channel.send(`You have to be a member of our club/server to use ${PREFIX}togglerole. Ask <@!${BOT_CREATOR}> or someone with @God of Robotics to give you any roles.`);
					return;
				}
				
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
			if(!(isAuthorBotCreator(message) && config.options.allow_eval_command)) {
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
			message.guild.channels.find("id", config.debug_channel_id).send(`${message.author} attempted to delete messages in ${message.channel} with command: ${message}.`);
			
			if(!isAuthorAdmin(message)) {
				message.channel.send("Sorry, but not everyone can be a dictator.");
				return;
			}
			if(config.options.restrict_purge_to_bot_creator && !isAuthorBotCreator(message)) {
				message.channel.send("Sorry, but not everyone should be a dictator.");
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
		hiddenFromHelp: true,
		execute: function(message, args) {
			if (message.channel.name !== "spam" && message.channel.id !== config.debug_channel_id) {
				const spamChannel = message.guild.channels.find("name", "spam") || "#spam";
				message.reply(`please use ${spamChannel} for bot commands next time.`);
			}
			
			if(message.member.roles.has(config.new_member_role)) {
				message.reply(`You have the new member role, which means we don't know your name. Change your nickname and then talk to <@!${BOT_CREATOR}> to add you to the sign in.`);
				return;
			}
			if(message.member.roles.has(config.other_team_role)) {
				message.reply("Only members of our team can use this command.");
				return;
			}
			if(!config.options.enable_log_command) {
				message.channel.send("Everyone's hours have been reset to 0.");
				return;
			}

			const content = args.trim();

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
						message.channel.send(`Sorry, I can't find "**${content}**" in the database. If ${content} **is** a member, talk to <@!${BOT_CREATOR}> and they'll add it to the sign in.`);
					}
				} else { // argument is not a name
					message.channel.send(`"${content}" should be a full name properly spelled.`);
				}
			} else { // no argument, default to user's own name
				const user = signinHelper.findUserFromDiscordId(memberNameList, message.author.id);
				if(user) { // user is in the database
					signinHelper.sendUserLog(db, message, user.name, user.isBoardMember, "in direct message");
				} else { // not in the database, could be from another team
					message.channel.send(`Sorry, I don't know your full name, ${getAuthorNickname(message)}. If you **are** a club member, you should be in the database, so talk to <@!${BOT_CREATOR}> and they'll add you to the sign in.`);
				}
			}
		}
	},

	{
		name: "tophours",
		description: "Will send a list of the top nine people with the most hours.",
		usage: "tophours",
		exampleUsage: "tophours",
		hiddenFromHelp: false,
		execute: function(message) {
			if(!config.options.enable_log_command) {
				message.channel.send("Everyone's hours have been reset to 0.");
				return;
			}

			const maxNameLength = 20;
			const lb = [];
			db.ref("log").once("value", snapshot => {
				const data = snapshot.val();
				for(const fullName in memberNameList) {
					const memberLog = data[fullName];
					if(memberLog) {
						const log = signinHelper.getTimeLog(memberLog.meetings, memberLog.subtract, false);
						lb.push({
							name: fullName,
							time: log.totalTime,
							formattedTime: log.formattedTime
						});
					}
				}
				const sortedTopTenList = lb.sort((a, b) => b.time - a.time).slice(0, 9);
				const formattedList = sortedTopTenList.map((member, index) => {
					const name = member.name.padStart(maxNameLength, " ");
					return `# ${index + 1} | ${name} | ${member.formattedTime}`;
				}).join("\n");
				const tableHeader = "  # |" + " ".repeat(maxNameLength - 3) + "NAME | TIME";
				message.channel.send("```markdown\n" + tableHeader + "\n" + formattedList + "```");
			});
		}
	},

	{
		name: "subtracthours",
		description: "Will subtract specified time from the person chosen. Can only be used by build leads. Subtract 0:00 hours to override the previous subtraction.",
		usage: 'subtracthours "<name of person>" "<time in h:mm format (has to be between 0:01 and 23:59>" "<optional date in M/D format>"',
		exampleUsage: 'subtracthours "Firstname Lastname" "3:30"',
		hiddenFromHelp: true,
		execute: function(message, content) {
			if(!isAuthorAdmin(message)) { // author is not an admin
				message.reply("Only admins can use this command.");
				return;
			}

			if(content && (/^"[A-Za-z]+ [A-Za-z]+( [A-Za-z]+)?" "(0|1|2)?\d:(0|1|2|3|4|5)\d"( "(0|1)?\d\/(0|1|2|3)?\d")?$/).test(content)) { // argument is specified and fits pattern
				const argumentList = content.replace(/"/g, " ").trim().split("   ");
				const name = argumentList[0];
				let hoursToSubtract = argumentList[1];

				const user = signinHelper.doesUserExist(memberNameList, name);
				if(user) { // user exists
					const timeToSubtract = hoursToSubtract.split(":");
					const minutesToSubtract = (+timeToSubtract[0])*60 + (+timeToSubtract[1]);
					if(minutesToSubtract < 1440) { // time subtracted less than 24 hours
						let date;
						if(argumentList.length > 2) { // date specified
							date = moment(argumentList[2] + moment().format("/YY"), "M/D/YY");
							if(!date.isValid()) {
								message.reply(`${argumentList[2]} is not a valid date in month/date format. ${moment().format("M/D")} is an example of a correct date.`);
								return;
							}
							if(!moment().isAfter(date)) {
								message.reply(argumentList[2] + " must be in the past. Make sure the date is in M/D format.");
								return;
							}
						} else { // date not specified
							date = moment();
						}

						// All the parameters are correct

						if(minutesToSubtract === 0) {
							hoursToSubtract = null;
						}

						// subtract hours from the Firebase sign-in database
						const updates = {};
						updates[date.format("YY-MM-DD")] = hoursToSubtract;
						const removalMessage = `**${getAuthorNickname(message)}** removed ${hoursToSubtract} (=${minutesToSubtract} minutes) from **${user.name}** for the date ${date.format("MMM D")}.`;
						db.ref(`log/${user.name}/subtract`).update(updates, () => {
							message.channel.send(removalMessage);
						});

						// send data to the subtracthours Discord webhook
						request.post(
							config.hours_log_webhook_url, {
								json: {
									content: removalMessage
								}
							}, (error, response, body) => {
								if(error) {
									debug(`ERROR:\n${error} | Status code ${response.statusCode} | ${body}`);
								}
							}
						);

					} else { // time to subtract not within bounds
						message.reply(`The maximum you can subtract is 23:59 from a person per day. ${hoursToSubtract} is not within the bounds.`);
					}
				} else { // user does not exist
					message.reply(`Sorry, I can't find "**${name}**" in the database. If ${name} **is** a member, talk to <@!${BOT_CREATOR}> and they'll fix this.`);
				}
			} else { // no argument or does not fit pattern, give error message
				message.reply('You need to specify the person\'s name and the hours to subtract from them, both in quotation marks. E.g.\n```' + PREFIX + 'subtracthours "Full Name" "2:55"```or if you specify date to subtract from (in M/D format)```' + PREFIX + 'subtracthours "Full Name" "4:10" "1/6"```');
			}
		}
	},

	{
		name: "tbateam",
		description: "Will give you information about a team given the team number.",
		usage: "tbateam <teamnumber t where t ∈ ℤ ∩ [1,7999]>",
		exampleUsage: "tbateam 2976",
		execute: function(message, content) {
			if(!content) { // no parameter
				message.channel.send("You need to specify a team number (1-7999).");
				return;
			}

			if(+content > 0 && +content <= 7999) { // parameter is valid
				// send a request to TheBlueAlliance's API for team information
				request({
					url: `http://www.thebluealliance.com/api/v3/team/frc${+content}?X-TBA-Auth-Key=${config.tba_auth_key}`,
					json: true
				}, (error, response, body) => {
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
				message.channel.send(`${content} is not a number between 1-7999.`);
			}
		}
	},
	
	{
		name: "disconnect",
		description: "Disconnects from voice channel.",
		usage: "disconnect",
		exampleUsage: "disconnect",
		hiddenFromHelp: false,
		execute: function(message) {
			const voiceChannel = message.guild.me.voiceChannel;
			if(voiceChannel) {
				voiceChannel.leave();
				message.channel.send(`Left voice channel ${voiceChannel.name}.`);
			}
		}
	},
	
	{
		name: "connect",
		description: "Connects to the author's voice channel if possible.",
		usage: "connect",
		exampleUsage: "connect",
		hiddenFromHelp: false,
		execute: function(message) {
			const voiceChannel = message.member.voiceChannel;
			if(voiceChannel) {
				voiceChannel.join().then(() => {
					message.channel.send(`Joined voice channel ${voiceChannel.name}.`);
				}).catch(error => {
					message.channel.send(`There was an error trying to join voice channel ${voiceChannel.name}.`);
					debug(`Error joining voice channel that ${getAuthorNickname(message)} is in: ${error}`);
				});
			} else {
				message.reply("You are not in a voice channel.");
			}
		}
	},
	
	{
		name: "queue",
		description: "Lists the items in the queue.",
		usage: "queue",
		exampleUsage: "queue",
		hiddenFromHelp: false,
		execute: function(message) {
			if(playing) {
				sendPlayingSongInfo(message.channel);
			}

			if(!queue.length) { // nothing in queue
				message.channel.send(`The queue is empty. You can add items to the queue with \`${PREFIX}addq\`.`);
				return;
			}

			let totalSongTimeSec = 0;

			const embed = new discord.RichEmbed()
				.setColor(0x12C40F)
				.setTitle("SpartaBeat Queue")
				.setThumbnail(bot.user.displayAvatarURL);
			
			for(let i = 0; i < queue.length; ++i) {
				const queueItem = queue[i];
				totalSongTimeSec += queueItem.duration;
				embed.addField(`#${i + 1}: ${queueItem.title}`, `(${formatSecondsAsTime(queueItem.duration)}) requested by ${queueItem.requester.displayName} ([Link](${queueItem.url}))`, false);
			}

			embed.setFooter("Total song time (sec): " + formatSecondsAsTime(totalSongTimeSec));

			message.channel.send({embed});
			
		}
	},
	
	{
		name: "play",
		description: "Starts playing the queue.",
		usage: "play",
		exampleUsage: "play",
		hiddenFromHelp: false,
		execute: function(message) {
			if(playing) {
				message.channel.send("Already playing music.");
				return;
			}

			playing = true;

			// play first item in queue
			play(message.channel, queue.shift());
		}
	},
	
	{
		name: "addq",
		description: "Adds to the queue a specified YouTube video by link or first search result.",
		usage: "addq <full youtube link OR search terms>",
		exampleUsage: "addq https://www.youtube.com/watch?v=98hwt-enGSE",
		hiddenFromHelp: false,
		execute: function(message, args) {
			if(!args) {
				message.channel.send("You must specify an argument, either a full YouTube link or some search terms.");
				return;
			}
			
			if((/^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/).test(args)) {
				// is a YouTube URL
				let ytUrlArg = args;
				if(!ytUrlArg.startsWith("http")) {
					ytUrlArg = "http://" + args;
				}
				ytdl.getInfo(ytUrlArg, (error, info) => {
					if(error || !info) {
						message.channel.send(ytUrlArg + " is not a valid YouTube URL.");
						return;
					}
					const youtubeUrl = ytUrlArg;
					const videoTitle = info.title || "???";
					const videoDuration = +info.length_seconds || 0;
					
					// add item to the end of the queue
					queue.push({
						title: videoTitle,
						duration: videoDuration,
						url: youtubeUrl,
						requester: message.member,
						timeRequested: moment().format("h:mm a")
					});
					
					sendAddQueueMessage(info, videoTitle, youtubeUrl, videoDuration, message);
					
				});
			} else {
				// search instead
				ytsearch(args, {
					maxResults: 1,
					key: config.youtube_api_key
				}, (err, results) => {
					if(err) {
						message.channel.send("Sorry there was an error searching for " + args);
						debug(`Error searching for '${args}'. Error: ${err}`);
						return;
					}
					if(!results) {
						message.channel.send("No results searching YouTube for " + args);
						return;
					}
					
					const youtubeUrl = results[0].link;
					
					ytdl.getInfo(youtubeUrl, (error, info) => {
						if(error || !info) {
							debug(`Error getting info on ${youtubeUrl}.`);
							return;
						}
						const videoTitle = info.title || "???";
						const videoDuration = +info.length_seconds || 0;
						
						// add item to the end of the queue
						queue.push({
							title: videoTitle,
							duration: videoDuration,
							url: youtubeUrl,
							requester: message.member,
							timeRequested: moment().format("h:mm a")
						});
						
						sendAddQueueMessage(info, videoTitle, youtubeUrl, videoDuration, message);
					});
				});
				
			}
		}
	},
		
	{
		name: "emoji",
		description: "Sends an animated emoji. Only works with animated emoji.",
		usage: "emoji <animated emoji name> <optional number to repeat 1-10>",
		exampleUsage: "emoji yeet 5",
		hiddenFromHelp: false,
		execute: function(message, args) {
			const argsWords = args.split(" ");
			message.delete();
			const emoji = message.guild.emojis.filter(r => r.animated).find("name", argsWords[0]);
			if(emoji) {
				let numEmojis = +argsWords[1];
				if(argsWords.length < 2 || !(numEmojis >= 1 && numEmojis < 10)) {
					numEmojis = 1;
				}
				message.channel.send(emoji.toString().repeat(numEmojis));
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
				const voiceChannel = message.guild.me.voiceChannel;
				if(voiceChannel) {
					voiceChannel.leave();
				}
				bot.destroy().then(() => {
					process.exit();
				});
			});
		}
	},
	
	{
		name: "ping",
		description: "Shows the bot's ping response time.",
		usage: "ping",
		exampleUsage: "ping",
		hiddenFromHelp: false,
		execute: function(message) {
			message.channel.send(Math.round(bot.ping) + " ms");
		}
	},

	{
		name: "help",
		description: "That's this command!",
		usage: "help <optional command>",
		exampleUsage: "help tbateam",
		execute: function(message, args) {
			const optionalArgument = args.toLowerCase().trim();

			if(!optionalArgument) { // list every non-hidden command
				const botDisplayName = message.guild.members.find(member => member.id === bot.user.id).displayName;
				const githubRepo = config.github_repo;
				const githubUrl = "https://github.com/" + githubRepo;
				const embed = new discord.RichEmbed()
					.setTitle(botDisplayName + "'s Command List")
					.setURL(githubUrl)
					.setColor(0x137CB8)
					.setAuthor(botDisplayName, "https://www.spartabots.org/images/spartabot-transparent-logo.png")
					.setDescription(`You can find my source code on my [GitHub repo](${githubUrl} "${githubRepo}"). I'm a Discord bot made by <@!${BOT_CREATOR}> using [discord.js](https://discord.js.org "discord.js home page"). Here's a list of my commands (there are a few hidden ones).`)
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