const axios = require('axios');
const moment = require('moment');
const Command = require('../command');
const LogCommand = require('../logcommand');
const signinHelper = require('../util/signinHelper');
const { config, send, reply, isAuthorAdmin, getAuthorNickname } = require('../util/util');

module.exports = new LogCommand(
	'subtracthours',
	'Will subtract specified time from the person chosen. Can only be used by build leads. Subtract 0:00 hours to override the previous subtraction.',
	'subtracthours "<name of person>" "<time in h:mm format (has to be between 0:01 and 23:59>" "<optional date in M/D format>"',
	'subtracthours "Firstname Lastname" "3:30"',
	async (message, content) => {
		if (!isAuthorAdmin(message)) { // author is not an admin
			message.reply('Only admins can use this command.');
			return;
		}

		if (content && (/^"([A-Za-z-]+ )+[A-Za-z-]+?" "(0|1|2)?\d:(0|1|2|3|4|5)\d"( "(0|1)?\d\/(0|1|2|3)?\d")?$/).test(content)) { // argument is specified and fits pattern
			const argumentList = content.replace(/"/g, ' ').trim().split('   ');
			const name = argumentList[0];
			let hoursToSubtract = argumentList[1];

			const user = signinHelper.doesUserExist(LogCommand.memberNameList, name);
			if (user) { // user exists
				const timeToSubtract = hoursToSubtract.split(':');
				const minutesToSubtract = (+timeToSubtract[0] * 60) + (+timeToSubtract[1]);
				if (minutesToSubtract < 1440) { // time subtracted less than 24 hours
					let date;
					if (argumentList.length > 2) { // date specified
						date = moment(argumentList[2] + moment().format('/YY'), 'M/D/YY');
						if (!date.isValid()) {
							reply(message, `${argumentList[2]} is not a valid date in month/date format. ${moment().format('M/D')} is an example of a correct date.`);
							return;
						}
						if (!moment().isAfter(date)) {
							reply(message, `${argumentList[2]} must be in the past. Make sure the date is in M/D format.`);
							return;
						}
					} else { // date not specified
						date = moment();
					}

					// All the parameters are correct

					if (minutesToSubtract === 0) {
						hoursToSubtract = null;
					}

					// subtract hours from the Firebase sign-in database
					const updates = {};
					updates[date.format('YY-MM-DD')] = hoursToSubtract;
					const removalMessage = `**${await getAuthorNickname(message)}** removed ${hoursToSubtract} (=${minutesToSubtract} minutes) from **${user.name}** for the date ${date.format('MMM D')}.`;
					LogCommand.db.ref(`log/${user.name}/subtract`).update(updates, () => {
						send(message.channel, removalMessage);
					});

					// send data to the subtracthours Discord webhook
					axios.post(config.get('hours_log_webhook_url'), {
						content: removalMessage,
					}).catch((error) => {
						if (error.response) {
							Command.debug(`Error:\n${error.data} | Status code ${error.status} | ${error.headers}`);
						} else {
							Command.debug(`Error:\n${error.message}`);
						}
					});
				} else { // time to subtract not within bounds
					reply(message, `The maximum you can subtract is 23:59 from a person per day. ${hoursToSubtract} is not within the bounds.`);
				}
			} else { // user does not exist
				reply(message, `Sorry, I can't find "**${name}**" in the database. Make sure you spell it correctly.`);
			}
		} else { // no argument or does not fit pattern, give error message
			const command = `${config.get('options.prefix')}subtracthours`;
			reply(message, `You need to specify the person's name and the hours to subtract from them, both in quotation marks. E.g.\n\`\`\`${command} "Full Name" "2:55"\`\`\` or if you specify date to subtract from (in M/D format): \`\`\`${command} "Full Name" "4:10" "1/6"\`\`\``);
		}
	},
);

module.exports.hideFromHelp();
