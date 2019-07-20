const discord = require('discord.js');
const Command = require('../command');

module.exports = new Command(
	'ping',
	"Shows the bot's ping response time.",
	'ping',
	'ping',
	(message) => {
		const ping = Math.round(Command.bot.ping); // in ms

		let color = 0xF62828; // red: high ping
		if (ping < 50) {
			color = 0x04C30E; // green: low ping
		} else if (ping < 100) {
			color = 0xBDC304; // yellow: ok ping
		}

		const embed = new discord.RichEmbed()
			.setColor(color)
			.setDescription(`${ping} ms`);
		message.channel.send({ embed });
	},
);
