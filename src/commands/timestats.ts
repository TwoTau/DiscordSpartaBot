import { MessageEmbed } from 'discord.js';
import LogCommand from '../logcommand';
import { getTimeLog } from '../util/signinHelper';
import { config, getTime, getAuthorNickname } from '../util/util';

export default new LogCommand(
	'timestats',
	"Will calculate the some basic stats for everyone's hours.",
	'timestats',
	'timestats',
	async (message) => {
		if (!(config.get('options.enable_log_command') as boolean)) {
			message.channel.send("Everyone's hours have been reset to 0.");
			return;
		}

		const data = (await LogCommand.db.ref('log').once('value')).val();

		const hoursList = [];
		let totalTime = 0;

		for (const fullName of Object.keys(LogCommand.memberNameList)) {
			const memberLog = data[fullName];
			if (memberLog?.meetings) {
				const log = getTimeLog(memberLog.meetings,
					memberLog.subtract, false);
				if (log.totalTime / 3600 < 1000 && log.totalTime > 18000) {
					hoursList.push(log.totalTime);
					totalTime += log.totalTime;
				}
			}
		}

		hoursList.sort();
		const n = hoursList.length;

		const mean = totalTime / n;

		let median;
		if (n % 2 === 0) {
			median = (hoursList[(n / 2) - 1] + hoursList[n / 2]) / 2;
		} else {
			median = hoursList[(n - 1) / 2];
		}

		const standDev = Math.sqrt(hoursList.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n);

		const embed = new MessageEmbed()
			.setColor(0x0ac12c)
			.setTitle(`Hours statistics as of ${getTime()}`)
			.addField('N', `${n} members`, true)
			.addField('Total time', `${Math.round(totalTime / 360) / 10} person-hours`, true)
			.addField('Median time', `${Math.round(median / 360) / 10} hours`, true)
			.addField('Mean time', `${Math.round(mean / 360) / 10} hours`, true)
			.addField('Standard deviation', `${Math.round(standDev / 360) / 10} hours`, true)
			.setTimestamp()
			.setFooter(`Calculated for ${await getAuthorNickname(message)}`);

		message.channel.send({ embeds: [embed] });
	},
);
