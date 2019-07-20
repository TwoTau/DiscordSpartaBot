const moment = require('moment');
const config = require('./config.json');

module.exports = class Command {
	/**
	 * Constructs a new command
	 *
	 * @param {string} name
	 * @param {string} description
	 * @param {string} usage
	 * @param {string} exampleUsage
	 * @param {function} execute function that executes with
	 *                           {Message} message and {string} content parameters
	 */
	constructor(name, description, usage, exampleUsage, execute) {
		this.name = name;
		this.description = description;
		this.usage = usage;
		this.exampleUsage = exampleUsage;
		this.execute = execute;
	}

	/**
	 * Set this command to be hidden from the list of commands in help
	 */
	hideFromHelp() {
		this.hiddenFromHelp = true;
	}

	/**
	 * Returns the time in a friendly format
	 *
	 * @returns {string} Date in M/DD h:mm a format
	 */
	static getTime() {
		return moment().format('M/DD h:mm a');
	}

	/**
	 * Sends text to the default debug channel, if it exists
	 *
	 * @param {string} text
	 * @returns {?Promise} Sending the message resolves with success or failure
	 */
	static debug(text) {
		// eslint-disable-next-line no-console
		console.log(text);
		const debugChannel = Command.bot.channels.get(config.debug_channel_id);
		if (debugChannel) {
			debugChannel.send(text);
		}
	}

	/**
	 * Checks whether the author of the message is the bot creator
	 *
	 * @param {Message} message
	 * @returns {boolean}
	 */
	static isAuthorBotCreator(message) {
		return message.author.id === config.bot_creator;
	}

	/**
	 * Returns whether the message author has the admin role or is the bot creator
	 *
	 * @param {Message} message
	 * @returns {boolean}
	 */
	static isAuthorAdmin(message) {
		const isAdmin = message.member.roles.has(config.admin_role);
		return isAdmin || this.isAuthorBotCreator(message);
	}

	/**
	 * Returns the display name or nickname of the message's author
	 *
	 * @param {Message} message
	 * @returns {string} the author's display name, or if not available,
	 *                   the author's nickname
	 */
	static getAuthorNickname(message) {
		if (message.member) {
			return message.member.displayName;
		}
		const { nickname } = message.guild.members.get(message.author.id);
		return (nickname || message.author.username);
	}
};
