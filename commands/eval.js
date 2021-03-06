/* eslint-disable no-unused-vars */
const axios = require('axios');
const discord = require('discord.js');
const moment = require('moment');
const util = require('util');
const Command = require('../command');
const LogCommand = require('../logcommand');
const signinHelper = require('../util/signinHelper');
const { send, config, isAuthorBotCreator } = require('../util/util');

function cleanResult(text) {
	return text.replace(/`/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
}

module.exports = new Command(
	'eval',
	'Executes JavaScript in a very unsafe manner. Can only be used by the bot creator.',
	'just don\'t',
	':regional_indicator_n: :o2:',
	(message, content) => {
		if (!isAuthorBotCreator(message) || !config.get('options.allow_eval_command')) {
			message.channel.send(':expressionless: :regional_indicator_n: :o2: :unamused:');
			return;
		}

		try {
			// eslint-disable-next-line no-eval
			let evaled = eval(content);
			if (typeof (evaled) !== 'string') {
				evaled = util.inspect(evaled);
			}
			if (typeof (evaled) === 'string') {
				evaled = cleanResult(evaled);
			}
			evaled = evaled.substring(0, 1950);
			message.channel.send(evaled, { code: 'xl' }).catch(() => {
				Command.debug('Eval result was empty');
			});
		} catch (error) {
			let errText = error;
			if (typeof (error) === 'string') {
				errText = cleanResult(error);
			}
			send(message.channel, `\`ERROR\` \`\`\`xl\n${errText}\n\`\`\``);
		}
	},
);

module.exports.hideFromHelp();
