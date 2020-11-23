const os = require('os');
const discord = require('discord.js');
const Command = require('../command');

module.exports = new Command(
	'stat',
	"Shows some information about the bot's process, like CPU and memory usage.",
	'stat',
	'stat',
	(message) => {
		const resources = process.resourceUsage();
		const memory = process.memoryUsage();

		const toMs = ((s) => `${Math.round(s / 1000)} ms`);
		const toMb = ((b) => `${Math.round((b * 100) / 1024 / 1024) / 100} MB`);

		const embed = new discord.MessageEmbed()
			.addField('User CPU time', toMs(resources.userCPUTime), true)
			.addField('System CPU time', toMs(resources.systemCPUTime), true)
			.addField('RSS', toMb(memory.rss), true)
			.addField('Heap total', toMb(memory.heapTotal), true)
			.addField('Heap used', toMb(memory.heapUsed), true)
			.addField('External memory', toMb(memory.external), true)
			.addField('PID', process.pid, true)
			.addField('Node version', process.versions.node, true)
			.addField('CPU arch', process.arch, true)
			.addField('Platform', `${process.platform} (${os.release()})`, true)
			.addField('Cores (logical)', os.cpus().length, true)
			.addField('Load avg', os.loadavg().map((n) => Math.round(n * 100) / 100).join(' '), true)
			.addField('Uptime', `${os.uptime()} sec`, true);

		message.channel.send({ embed });
	},
);
