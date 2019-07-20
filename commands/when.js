const discord = require('discord.js');
const moment = require('moment');
const Command = require('../command');
const config = require('../config.json');

function addEventInfoToEmbed(eventArg, embed) {
	const { name, timestamp } = config.events[eventArg];

	const seconds = moment(timestamp).diff(moment(), 'seconds');
	const absMin = Math.abs(seconds / 60);
	const tillOrSince = (seconds > 0) ? 'till' : 'since';

	embed.addField(`Time ${tillOrSince} ${name}`, `${Math.round(absMin)} minutes = ${Math.round(absMin / 60)} hours = **${Math.round(absMin / 144) / 10} days**`, false);
}

module.exports = new Command(
	'when',
	`Will tell you how much time there is until an event. Argument must be one of these: ${Object.keys(config.events).join(', ')}.`,
	'when <event name>',
	'when stopbuild',
	(message, content) => {
		const allowedEventNames = Object.keys(config.events);
		const allowedEventNamesAsList = `_${allowedEventNames.join('_, _')}_`;

		if (!content) {
			message.channel.send(`You can specify an argument in this list: ${allowedEventNamesAsList}.`);

			const embed = new discord.RichEmbed().setColor(0x0ac12c);
			for (const eventArg of allowedEventNames) {
				addEventInfoToEmbed(eventArg, embed);
			}
			message.channel.send({ embed });
			return;
		}

		const args = content.toLowerCase().trim();
		if (allowedEventNames.includes(args)) {
			const embed = new discord.RichEmbed().setColor(0x0ac12c);
			addEventInfoToEmbed(args, embed);
			message.channel.send({ embed });
		} else {
			message.channel.send(`"${content}" must in this list: ${allowedEventNamesAsList}.`);
		}
	},
);
