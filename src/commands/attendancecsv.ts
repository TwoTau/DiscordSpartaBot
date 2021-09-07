import { writeFile } from 'fs';
import Command from '../command';
import LogCommand from '../logcommand';
import { getTimeLog } from '../util/signinHelper';
import { send, config, isAuthorAdmin } from '../util/util';

const cmd = new LogCommand(
	'attendancecsv',
	'Will send a CSV of all the hours in the format `name,seconds`. If no argument, outputs as a Discord message. Only admins can use this command.',
	'attendancecsv <optional argument yes>',
	'attendancecsv yes',
	async (message, content) => {
		if (!(config.get('options.enable_log_command') as boolean)) {
			message.channel.send('Everyone\'s hours have been reset to 0.');
			return;
		}

		if (!isAuthorAdmin(message)) {
			message.reply('Only admins can use this command.');
			return;
		}

		const data = (await LogCommand.db.ref('log').once('value')).val();

		const lb = [];

		for (const fullName of Object.keys(LogCommand.memberNameList)) {
			const memberLog = data[fullName];

			const logObject = {
				name: fullName,
				time: 0,
				formattedTime: '0:00',
			};

			if (memberLog?.meetings) {
				const log = getTimeLog(memberLog.meetings,
					memberLog.subtract, false);
				logObject.time = log.totalTime;
				logObject.formattedTime = log.formattedTime;
			}

			lb.push(logObject);
		}

		const csv = lb.map((member) => `${member.name},${member.time}`).join('\n');

		if (['yes', 'true', 'y', 'file'].includes(content?.toLowerCase())) { // send as file
			const FILE_NAME = 'attendance.csv';
			const FILE_CONTENTS = `Name,Seconds\n${csv}`;

			writeFile(FILE_NAME, FILE_CONTENTS, (err) => {
				if (err) {
					Command.debug(`Error creating file ${FILE_NAME}: ${err}`);
					message.channel.send('Sorry, there was an error creating the file.');
				} else {
					message.channel.send({
						files: [{
							attachment: FILE_NAME,
							name: FILE_NAME,
						}],
					});
				}
			});
		} else { // no argument
			send(message.channel, csv, undefined, '', ['\n']);
		}
	},
);

cmd.hideFromHelp();

export default cmd;
