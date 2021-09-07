/* eslint-disable no-underscore-dangle */
import { Client, Message, Snowflake, TextChannel } from 'discord.js';

import { config, send } from './util/util';

class Command {
	private _name: string;

	private _description: string;

	private _usage: string;

	private _exampleUsage: string;

	execute: (message: Message, content: string) => Promise<void>;

	private _hiddenFromHelp: boolean;

	static bot: Client;

	constructor(name: string, description: string, usage: string, exampleUsage: string, execute: (message: Message, content: string) => Promise<void>) {
		this._name = name;
		this._description = description;
		this._usage = usage;
		this._exampleUsage = exampleUsage;
		this._hiddenFromHelp = false;
		this.execute = execute;
	}

	/**
	 * Set this command to be hidden from the list of commands in help
	 */
	hideFromHelp(): void {
		this._hiddenFromHelp = true;
	}

	get name(): string {
		return this._name;
	}

	get description(): string {
		return this._description;
	}

	get usage(): string {
		return this._usage;
	}

	get exampleUsage(): string {
		return this._exampleUsage;
	}

	get isHiddenFromHelp(): boolean {
		return this._hiddenFromHelp;
	}

	/**
	 * Sends text to the default debug channel, if it exists
	 *
	 * @param {string} text
	 * @returns {Promise<Message|null>} Sending the message resolves with success or failure
	 */
	static async debug(text: string): Promise<Message|null> {
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
		const debugChannelId = config.get('debug_channel_id') as Snowflake;
		const debugChannel = await Command.bot.channels.fetch(debugChannelId) as TextChannel;
		return debugChannel ? send(debugChannel, clean) : null;
	}
}

export default Command;
