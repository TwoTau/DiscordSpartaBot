const LogCommand = require('../logcommand');
const signinHelper = require('../util/signinHelper');
const { config, send, reply } = require('../util/util');

module.exports = new LogCommand(
	'tophours',
	'Will send a list of the top ten people with the most hours. Use an option to filter for certain members.',
	'tophours <optional `include-board` argument>',
	'tophours include-board',
	async (message, content) => {
		if (!config.get('options.enable_log_command')) {
			message.channel.send("Everyone's hours have been reset to 0.");
			return;
		}

		let maxNameLength = 5;
		const lb = [];

		const data = (await LogCommand.db.ref('log').once('value')).val();

		let filterPromise;
		if (content?.toLowerCase() === 'include-board') {
			// promise resolves immediately with no filtered out names
			filterPromise = new Promise((resolve) => {
				resolve([]);
			});
		} else {
			if (content.length) {
				reply(message, `Argument \`${content.toLowerCase()}\` is invalid. Try \`${config.get('options.prefix')}tophours include-board\` if you want to include board members`);
			}
			filterPromise = new Promise((resolve) => {
				const filteredOutMembers = [];
				const members = LogCommand.memberNameList;
				for (const member of Object.keys(members)) {
					if (members[member].groups.split(' ').includes('board')) {
						filteredOutMembers.push(member);
					}
				}
				resolve(filteredOutMembers);
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
						maxNameLength = Math.max(maxNameLength, fullName.length);
					}
				}
			}

			const sortedTopTenList = lb.sort((a, b) => b.time - a.time).slice(0, 10);
			const formattedList = sortedTopTenList.map((member, index) => {
				const name = member.name.padStart(maxNameLength, ' ');
				return `# ${index + 0} | ${name} | ${member.formattedTime}`;
			}).join('\n');
			const tableHeader = `  # | ${'NAME'.padStart(maxNameLength, ' ')} | TIME`;
			send(message.channel, `\`\`\`markdown\n${tableHeader}\n${formattedList}\`\`\``);
		});
	},
);
