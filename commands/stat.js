const os = require('os');
const discord = require('discord.js');
const Command = require('../command');

function toMs(seconds) {
	return `${Math.round(seconds / 1000)} ms`;
}

function toMb(bytes) {
	return `${Math.round((bytes * 100) / 1024 / 1024) / 100} MB`;
}

module.exports = new Command(
	'stat',
	"Shows some information about the bot's process, like CPU and memory usage.",
	'stat',
	'stat',
	(message) => {
		const resources = process.resourceUsage();
		const memory = process.memoryUsage();

		const embed = new discord.MessageEmbed()
			.addField('User CPU time', toMs(resources.userCPUTime), true)
			.addField('System CPU time', toMs(resources.systemCPUTime), true)
			.addField('RSS', toMb(memory.rss), true)
			.addField('Heap total', toMb(memory.heapTotal), true)
			.addField('Heap used', toMb(memory.heapUsed), true)
			.addField('External memory', toMb(memory.external), true)
			.addField('PID', process.pid.toString(), true)
			.addField('Node.js version', process.versions.node, true)
			.addField('CPU arch', process.arch, true)
			.addField('Platform', `${process.platform} (${os.release()})`, true)
			.addField('Cores (logical)', os.cpus().length.toString(), true)
			.addField('Load avg', os.loadavg().map((n) => Math.round(n * 100) / 100).join(' '), true)
			.addField('Process uptime', `${Math.floor(process.uptime())} sec`, true)
			.addField('OS uptime', `${Math.floor(os.uptime())} sec`, true);

		message.channel.send({ embeds: [embed] });
	},
);
