const { config, send } = require('./util/util');

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
	 * Sends text to the default debug channel, if it exists
	 *
	 * @param {string} text
	 * @returns {?Promise} Sending the message resolves with success or failure
	 */
	static async debug(text) {
		// eslint-disable-next-line no-console
		console.log(text);
		let clean = text;
		if (text === undefined) {
			clean = '<undefined>';
		} else if (text === null) {
			clean = '<null>';
		} else if (text === '') {
			clean = '<empty string \'\'>';
		}
		const debugChannel = await Command.bot.channels.fetch(config.get('debug_channel_id'));
		return debugChannel ? send(debugChannel, clean) : null;
	}
};
