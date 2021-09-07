import { MessageEmbed } from 'discord.js';
import Command from '../command';

export default new Command(
	'ping',
	"Shows the bot's ping response time.",
	'ping',
	'ping',
	async (message) => {
		const ping = Math.round(Command.bot.ws.ping); // in ms

		let color = 0xF62828; // red: high ping
		if (ping < 50) {
			color = 0x04C30E; // green: low ping
		} else if (ping < 100) {
			color = 0xBDC304; // yellow: ok ping
		}

		const embed = new MessageEmbed()
			.setColor(color)
			.setDescription(`${ping} ms`);
		message.channel.send({ embeds: [embed] });
	},
);
