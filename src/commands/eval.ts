/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import axios from 'axios';
import * as discord from 'discord.js';
import * as moment from 'moment';
import { inspect } from 'util';
import Command from '../command';
import LogCommand from '../logcommand';
import * as signinHelper from '../util/signinHelper';
import { send, config, isAuthorBotCreator, reply, getAuthorNickname } from '../util/util';

function cleanResult(text: string) {
	return text.replace(/`/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
}

const cmd = new Command(
	'eval',
	'Executes JavaScript in a very unsafe manner. Can only be used by the bot creator.',
	'just don\'t',
	':regional_indicator_n: :o2:',
	async (message, content) => {
		if (!isAuthorBotCreator(message) || !config.get('options.allow_eval_command')) {
			message.channel.send(':expressionless: :regional_indicator_n: :o2: :unamused:');
			return;
		}

		try {
			// eslint-disable-next-line no-eval
			let evaled = eval(content);
			if (typeof evaled !== 'string') {
				evaled = inspect(evaled);
			}
			if (typeof evaled === 'string') {
				evaled = cleanResult(evaled);
			}
			evaled = evaled.substring(0, 1950);
			message.channel.send(`\`\`\`${evaled}\`\`\``).catch(() => {
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

cmd.hideFromHelp();

export default cmd;
