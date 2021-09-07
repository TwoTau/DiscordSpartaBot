import { Message, Snowflake, TextBasedChannels, User } from 'discord.js';
import * as moment from 'moment';
import * as initialConfig from '../config.json';

const MAX_DISCORD_MESSAGE_LENGTH = 2000;
const ELLIPSES = '…';

function getNextChunkEnd(string: string, maxLength: number, appendString: string, splitOn: string[]) {
	const end = maxLength - appendString.length;
	// try to split on a nice character, but ensure the chunk is at least 3/4 of the maxLength
	for (let i = end; i > maxLength * (3 / 4) && i > 0; i--) {
		if (splitOn.includes(string.charAt(i))) {
			return i;
		}
	}
	// cannot split on a nice character, so split at max length
	return end;
}

// Sends the given message through the given function so that it does not exceed the max character length
const safeSend = (channel: TextBasedChannels | Message | User, isMessage: boolean, message: string, maxLength: number, appendString: string, splitOn: string[]): Promise<Message> => {
	if (message.length <= maxLength) {
		if (isMessage) {
			return (channel as Message).reply(message);
		}
		return (channel as TextBasedChannels).send(message);
	}

	const chunkLength = getNextChunkEnd(message, maxLength, appendString, splitOn);
	const content = message.substr(0, chunkLength) + appendString;
	if (isMessage) {
		if (isMessage) {
			(channel as Message).reply(content);
		} else {
			(channel as TextBasedChannels).send(content);
		}
	}

	return safeSend(channel, isMessage, message.substr(chunkLength), maxLength, appendString, splitOn);
};

// recursive helper method for ConfigManager.set
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setHelper(data: Record<string, any>, keyArray: string[], value: unknown) {
	if (!keyArray.length) {
		return value;
	}
	const firstKey = keyArray.shift();
	if (!['undefined', 'object'].includes(typeof data)) {
		throw new ReferenceError('Invalid path.');
	}
	// eslint-disable-next-line no-param-reassign
	data = data ?? {};
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, no-param-reassign
	data[firstKey!] = setHelper(data[firstKey!], keyArray, value);
	return data;
}

class ConfigManager {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private data: any;

	constructor(data: unknown) {
		this.data = data;
	}

	/**
	 * Returns the value at the given key. Omit key to get the entire config.
	 * @param {string?} key Property to find, use period (.) for nesting
	 * @returns {any} Value associated with the key
	 * @throws {ReferenceError} if key represents an invalid path
	 */
	get(key?: string): unknown {
		let value = this.data;
		if (key !== undefined && key !== null) {
			for (const nextKey of key.split('.')) {
				if (value) {
					value = value[nextKey];
				} else {
					throw new ReferenceError(`Cannot find property ${nextKey} in ${key}`);
				}
			}
		}
		return value;
	}

	/**
	 * Sets the given key to the given value.
	 * @param {string?} key Property
	 * @param {any} value Value to associate with the key, use period for nesting
	 * @returns {any} previous value associated with key, if any
	 * @throws {ReferenceError} if key represents an invalid path
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	set(key: string, value: any): unknown {
		const prev = this.get(key);
		this.data = setHelper(this.data, key.split('.'), value);
		return prev;
	}
}

/**
* Sends the given message to the given channel in valid chunks.
* @param {Channel} channel Discord channel
* @param {string} message Actual text to send
* @param {integer?} maxLength Max character length of message, default 2000
* @param {string?} appendString String to append to the end of concattenated message, default ellipses
* @param {string[]?} splitOn Array of characters/substrings to try to split the message
*/
export function send(channel: TextBasedChannels | User, message: string, maxLength = MAX_DISCORD_MESSAGE_LENGTH, appendString = ELLIPSES, splitOn = [' ', '\n']): Promise<Message> {
	return safeSend(channel, false, message, maxLength, appendString, splitOn);
}

/**
 * Sends the given message as a reply to the given message in valid chunks.
 * @param {Message} messageToReplyTo Discord message
 * @param {string} message Actual text to send
 * @param {integer?} maxLength Max character length of message, default 2000
 * @param {string?} appendString String to append to the end of concattenated message, default ellipses
 * @param {string[]?} splitOn Array of characters/substrings to try to split the message
 */
export function reply(messageToReplyTo: Message, message: string, maxLength = MAX_DISCORD_MESSAGE_LENGTH, appendString = ELLIPSES, splitOn = [' ', '\n']): Promise<Message> {
	return safeSend(messageToReplyTo, true, message, maxLength, appendString, splitOn);
}

// eslint-disable-next-line no-underscore-dangle
const _config = new ConfigManager(initialConfig);
/**
 * ConfigManager, with getters and setters
 */
export const config = _config;

/**
 * Returns the time in a friendly format
 *
 * @returns {string} Date in M/DD h:mm a format
 */
export function getTime(): string {
	return moment().format('M/DD h:mm a');
}

/**
 * Checks whether the author of the message is the bot creator
 *
 * @param {Message} message Discord message
 * @returns {boolean} true iff message author is bot creator
 */
export function isAuthorBotCreator(message: Message): boolean {
	return message.author.id === (_config.get('bot_creator') as Snowflake);
}

/**
 * Returns whether the message author has the admin role or is the bot creator
 *
 * @param {Message} message Discord message
 * @returns {boolean} true iff message author is "admin"
 */
export function isAuthorAdmin(message: Message): boolean {
	const adminRole = _config.get('admin_role') as Snowflake;
	const isAdmin = message.member?.roles.cache.has(adminRole);
	return isAdmin || module.exports.isAuthorBotCreator(message);
}

/**
 * Returns the display name or nickname of the message's author
 *
 * @param {Message} message
 * @returns {Promise<string>} the author's display name, or if not available, the author's nickname
 */
export async function getAuthorNickname(message: Message): Promise<string> {
	if (message.member) {
		return message.member.displayName;
	}
	const member = await message.guild?.members.fetch(message.author.id);
	return member?.nickname ?? message.author.username;
}

/*

// eslint-disable-next-line no-unused-vars
function testSafeSend() {
	const mockChannel = {
		send: console.log,
	};
	console.log('1234567890');
	module.exports.send(mockChannel, 'the quick brown foxxxxxxxx jumped over the lazy dog', 10);
	module.exports.send(mockChannel, 'abcdefghi 123', 10);
	module.exports.send(mockChannel, 'a       b       c         d', 10);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function testConfig() {
	const config2 = new ConfigManager({
		x: 1,
		y: 2,
		a: {
			b: {
				c: 3,
			},
		},
	});

	const get = (prop) => console.log(`${prop} = ${JSON.stringify(config2.get(prop))}`);
	const set = (prop, value) => console.log(`Prev ${prop} = ${JSON.stringify(config2.set(prop, value))}`);

	get('x');
	get('y');
	get('x.y');
	set('a.b.c', 100);
	set('a.c.e', 100);
	set('0', 0);
	config2.get();
}

if (!module.parent) { // run explicitly (not as a require())
	testSafeSend();
	// testConfig();
}

*/
