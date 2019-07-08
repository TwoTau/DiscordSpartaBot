const Command = require("../command");
const LogCommand = require("../logcommand");
const config = require("../config.json");
const signinHelper = require("../signinHelper");

module.exports = new LogCommand(
	"attendancecsv",
	"Will send a CSV of all the hours. Only admins can use this command.",
	"attendancecsv",
	"attendancecsv",
	function (message) {
		if (!config.options.enable_log_command) {
			message.channel.send("Everyone's hours have been reset to 0.");
			return;
		}

		if (!Command.isAuthorAdmin(message)) {
			message.reply("Only admins can use this command.");
			return;
		}

		LogCommand.db.ref("log").once("value", snapshot => {
			const data = snapshot.val();
			
			const lb = [];

			for (const fullName in LogCommand.memberNameList) {
				const memberLog = data[fullName];

				const logObject = {
					name: fullName,
					time: 0,
					formattedTime: "0:00"
				};

				if (memberLog) {
					const log = signinHelper.getTimeLog(memberLog.meetings,
						memberLog.subtract, false);
					logObject.time = log.totalTime;
					logObject.formattedTime = log.formattedTime;
				}

				lb.push(logObject);
			}

			const csv = lb.map((member) => {
				return member.name + "," + member.time;
			}).join("\n");

			message.channel.send(csv);
		});
	}
);

module.exports.hideFromHelp();