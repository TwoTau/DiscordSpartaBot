import { MessageEmbed } from 'discord.js';
import * as moment from 'moment';
import Command from '../command';
import { config, send } from '../util/util';

type IsoTimestamp = string;
type EventsConfig = {
	[eventName: string]: {
		name: string,
		timestamp: IsoTimestamp;
	}
}

function addEventInfoToEmbed(eventArg: string, embed: MessageEmbed) {
	const events = config.get('events') as EventsConfig;
	const { name, timestamp } = events[eventArg];

	const seconds = moment(timestamp).diff(moment(), 'seconds');
	const absMin = Math.abs(seconds / 60);
	const tillOrSince = (seconds > 0) ? 'till' : 'since';

	embed.addField(`Time ${tillOrSince} ${name}`, `${Math.round(absMin)} minutes = ${Math.round(absMin / 60)} hours = **${Math.round(absMin / 144) / 10} days**`, false);
}

export default new Command(
	'when',
	`Will tell you how much time there is until an event. Argument must be one of these: ${Object.keys(config.get('events') as EventsConfig).join(', ')}.`,
	'when <optional event name>',
	'when',
	async (message, content) => {
		const allowedEventNames = Object.keys(config.get('events') as EventsConfig);
		const allowedEventNamesAsList = `_${allowedEventNames.join('_, _')}_`;

		if (!content) {
			send(message.channel, `(By the way, you can specify a single event from this list: ${allowedEventNamesAsList})`);

			const embed = new MessageEmbed().setColor(0x0ac12c);
			for (const eventArg of allowedEventNames) {
				addEventInfoToEmbed(eventArg, embed);
			}
			message.channel.send({ embeds: [embed] });
			return;
		}

		const args = content.toLowerCase().trim();
		if (allowedEventNames.includes(args)) {
			const embed = new MessageEmbed().setColor(0x0ac12c);
			addEventInfoToEmbed(args, embed);
			message.channel.send({ embeds: [embed] });
		} else {
			send(message.channel, `Sorry, I don't know when that event is. Maybe you mean something in this list: ${allowedEventNamesAsList}.`);
		}
	},
);
