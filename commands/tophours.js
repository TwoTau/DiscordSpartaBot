const LogCommand = require('../logcommand');
const signinHelper = require('../util/signinHelper');
const config = require('../config.json');

module.exports = new LogCommand(
	'tophours',
	'Will send a list of the top nine people with the most hours. Use an option to filter for certain members.',
	'tophours <optional `no-present` or `no-board` argument>',
	'tophours no-present',
	async (message, content) => {
		if (!config.options.enable_log_command) {
			message.channel.send("Everyone's hours have been reset to 0.");
			return;
		}

		const maxNameLength = 20;
		const lb = [];

		const data = (await LogCommand.db.ref('log').once('value')).val();

		let filterPromise;
		if (content.toLowerCase() === 'no-present' || content.toLowerCase() === 'no-board') {
			const filterOut = content.toLowerCase().substring(3);
			filterPromise = new Promise((resolve) => {
				LogCommand.db.ref('members').once('value').then((membersSnap) => {
					const filteredOutMembers = [];
					const members = membersSnap.val();
					for (const member of Object.keys(members)) {
						if (members[member][filterOut]) {
							filteredOutMembers.push(member);
						}
					}
					resolve(filteredOutMembers);
				});
			});
		} else {
			// promise resolves immediately with no filtered out names
			filterPromise = new Promise((resolve) => {
				resolve([]);
			});
		}

		filterPromise.then((filteredOutMembers) => {
			for (const fullName of Object.keys(LogCommand.memberNameList)) {
				if (!filteredOutMembers.includes(fullName)) {
					const memberLog = data[fullName];
					if (memberLog && memberLog.meetings) {
						const log = signinHelper.getTimeLog(memberLog.meetings,
							memberLog.subtract, false);
						lb.push({
							name: fullName,
							time: log.totalTime,
							formattedTime: log.formattedTime,
						});
					}
				}
			}

			const sortedTopTenList = lb.sort((a, b) => b.time - a.time).slice(0, 10);
			const formattedList = sortedTopTenList.map((member, index) => {
				const name = member.name.padStart(maxNameLength, ' ');
				return `# ${index + 0} | ${name} | ${member.formattedTime}`;
			}).join('\n');
			const tableHeader = `  # |${' '.repeat(maxNameLength - 3)}NAME | TIME`;
			message.channel.send(`\`\`\`\`markdown\n${tableHeader}\n${formattedList}\`\`\``);
		});
	},
);
