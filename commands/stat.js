const Command = require("../command");
const discord = require("discord.js");

module.exports = new Command(
	"stat",
	"Shows some information about the bot's process.",
	"stat",
	"stat",
	function (message) {
		const resources = process.resourceUsage();
		
		const embed = new discord.RichEmbed()
			.addField("User CPU time", resources.userCPUTime / 1000 + " ms", true)
			.addField("System CPU time", resources.systemCPUTime / 1000 + " ms", true)
			.addField("Node version", process.versions.node, true)
			.addField("Platform", process.platform, true);
		
		message.channel.send({ embed });
	}
);