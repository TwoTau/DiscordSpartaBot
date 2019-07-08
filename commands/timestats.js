const Command = require("../command");
const LogCommand = require("../logcommand");
const config = require("../config.json");
const signinHelper = require("../signinHelper");
const discord = require("discord.js");

module.exports = new LogCommand(
	"timestats",
	"Will calculate the some basic stats for everyone's hours.",
	"timestats",
	"timestats",
	function (message) {
		if (!config.options.enable_log_command) {
			message.channel.send("Everyone's hours have been reset to 0.");
			return;
		}

		LogCommand.db.ref("log").once("value", snapshot => {
			const data = snapshot.val();

			const hoursList = [];
			let totalTime = 0;

			for (const fullName in LogCommand.memberNameList) {
				const memberLog = data[fullName];
				if (memberLog) {
					const log = signinHelper.getTimeLog(memberLog.meetings,
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

			let standDev = 0;
			for (const a of hoursList) {
				standDev += Math.pow(a - mean, 2);
			}
			standDev = Math.sqrt(standDev / n);

			const embed = new discord.RichEmbed()
				.setColor(0x0ac12c)
				.setTitle("Hours statistics as of " + Command.getTime())
				.addField("N", n + " members", true)
				.addField("Total time",
					(Math.round(totalTime / 360) / 10) + " person-hours", true)
				.addField("Median time",
					(Math.round(median / 360) / 10) + " hours", true)
				.addField("Mean time",
					(Math.round(mean / 360) / 10) + " hours", true)
				.addField("Standard deviation",
					(Math.round(standDev / 360) / 10) + " hours", true)
				.setTimestamp()
				.setFooter("Calculated for " + Command.getAuthorNickname(message));

			message.channel.send({ embed });
		});
	}
);