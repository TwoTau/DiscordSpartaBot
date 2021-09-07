import * as moment from 'moment';
import LogCommand from '../logcommand';
import { config, send, reply, isAuthorAdmin } from '../util/util';

/**
 * Checks and returns whether the given member signed in on the given day.
 * @param {String} member Full name of the member to check
 * @param {String} date Date to check
 * @return {Promise<String?>} member if signed in, else null
 */
async function signedInOn(member: string, date: string) {
	const data = await LogCommand.db.ref(`log/${member}/meetings/${date}`).once('value');
	return data.val() ? member : null;
}

const cmd = new LogCommand(
	'signedinon',
	'Will send a list of people signed in the specified date. Only admins can use this command.',
	'signedinon <date in YYYY-MM-DD format>',
	`signedinon ${moment().format('YYYY-MM-DD')}`,
	async (message, content) => {
		if (!config.get('options.enable_log_command')) {
			message.channel.send("Everyone's hours have been reset to 0.");
			return;
		}

		if (!isAuthorAdmin(message)) {
			message.reply('Only admins can use this command.');
			return;
		}

		const date = content;
		if (!date) {
			message.reply('This command requires a parameter date in YYYY-MM-DD format');
			return;
		}
		if (!(/^[0-9]{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/).test(date)) {
			reply(message, `'${date}' is not in YYYY-MM-DD format`);
			return;
		}

		const promises = [];
		for (const fullName of Object.keys(LogCommand.memberNameList)) {
			promises.push(signedInOn(fullName, date));
		}
		const present = (await Promise.all(promises)).filter((x) => x !== null);
		send(message.channel, present.length > 0 ? present.sort().join('\n') : `No members signed in on ${date}.`);
	},
);

cmd.hideFromHelp();

export default cmd;
