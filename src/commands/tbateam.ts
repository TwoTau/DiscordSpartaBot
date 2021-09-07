/* eslint-disable camelcase */
import axios from 'axios';
import { MessageEmbed } from 'discord.js';
import * as moment from 'moment';
import Command from '../command';
import { send, config } from '../util/util';

type TbaTeam = {
	key: string,
	team_number: number,
	nickname: string | null,
	name: string,
	school_name: string | null,
	city: string | null,
	state_prov: string | null,
	country: string | null,
	address: string | null,
	postal_code: string | null,
	gmaps_place_id: string | null,
	gmaps_url: string | null,
	lat: number | null,
	lng: number | null,
	location_name: string | null,
	website: string | null,
	rookie_year: number | null,
	motto: string | null,
	home_championship: unknown | null,
}

type TbaSimpleEvent = {
	key: string,
	name: string,
	event_code: string,
	event_type: number,
	district: {
		abbreviation: string,
		display_name: string,
		key: string,
		year: number,
	} | null,
	city: string | null,
	state_prov: string | null,
	country: string | null,
	start_date: string,
	end_date: string,
	year: number,
}

const MAX_TEAM_NUMBER = 9000;

const authParams = {
	params: {
		'X-TBA-Auth-Key': config.get('tba_auth_key'),
	},
};

const API_DATE_FORMAT = 'YYYY-MM-DD';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleTBAApiError(error: any) {
	if (error.response) {
		Command.debug(`Something went wrong with using TBA's API.\nError ${error.response.status}`);
	} else {
		Command.debug(`Something went wrong.\nError:\n${error.message}`);
	}
}

async function addAwardsToEmbed(embed: MessageEmbed, teamNumber: number) {
	let response;
	try {
		response = await axios.get(`http://www.thebluealliance.com/api/v3/team/frc${teamNumber}/awards`, authParams);
	} catch (error) {
		handleTBAApiError(error);
		return;
	}

	let numAwardsWon = '0 (yet)';
	if (response.data.length > 0) {
		const latest = response.data[response.data.length - 1].event_key;
		numAwardsWon = `${response.data.length} (latest [${latest}](https://www.thebluealliance.com/event/${latest}))`;
	}
	embed.addField('Awards won', numAwardsWon, true);
}

function compareByDates(a: TbaSimpleEvent, b: TbaSimpleEvent) {
	return moment(a.start_date, API_DATE_FORMAT).isAfter(moment(b.start_date, API_DATE_FORMAT)) ? -1 : 1;
}

async function addEventsToEmbed(embed: MessageEmbed, teamNumber: number) {
	let response;
	try {
		response = await axios.get(`http://www.thebluealliance.com/api/v3/team/frc${teamNumber}/events/simple`, authParams);
	} catch (error) {
		handleTBAApiError(error);
		return;
	}

	if (response.data.length > 0) {
		const data = response.data as TbaSimpleEvent[];
		// get 5 most recent events
		const mostRecentEvents = data.sort(compareByDates).slice(0, 5).map((event) => {
			const date = moment(event.start_date, API_DATE_FORMAT).format('MM/DD/YYYY');
			return `[\`${date}\` - ${event.name}](https://www.thebluealliance.com/event/${event.key})`;
		});

		let eventsAsString = mostRecentEvents.join('\n');
		if (response.data.length > mostRecentEvents.length) {
			eventsAsString += `\n...and ${response.data.length - 5} more`;
		}

		embed.addField('Events', eventsAsString, false);
	}
}

async function makeEmbed(data: TbaTeam) {
	const teamNumber = data.team_number;
	const motto = data.motto ? `"${data.motto}"` : '_none_';
	const location = data.city ? `${data.city}, ${data.state_prov}` : 'unknown';
	const nickname = data.nickname || '';

	const embed = new MessageEmbed()
		.setTitle(`FRC Team ${teamNumber}: ${nickname}`)
		.setURL(`https://www.thebluealliance.com/team/${data.team_number}`)
		.setColor(0x12C40F)
		.addField('Team number', `${teamNumber}`, true)
		.addField('Nickname', nickname, true)
		.addField('Location', location, true)
		.addField('Motto', motto, true)
		.addField('Website', data.website || '_none_', true)
		.addField('Rookie year', `${data.rookie_year}`, true);

	await addAwardsToEmbed(embed, teamNumber);

	await addEventsToEmbed(embed, teamNumber);

	return embed;
}

export default new Command(
	'tbateam',
	'Will give you information about a team given the team number.',
	`tbateam <teamnumber t where t ∈ ℤ ∩ [1,${MAX_TEAM_NUMBER}]>`,
	'tbateam 2976',
	async (message, content) => {
		if (!content) { // no parameter
			message.channel.send(`You need to specify a team number (1-${MAX_TEAM_NUMBER}).`);
			return;
		}

		const teamNumber = +content;

		if (teamNumber > 0 && teamNumber <= MAX_TEAM_NUMBER) { // parameter is valid
			message.channel.sendTyping(); // loading indicator

			// send a request to TheBlueAlliance's API for team information
			try {
				const response = await axios.get(`http://www.thebluealliance.com/api/v3/team/frc${teamNumber}`, authParams);
				const embed = await makeEmbed(response.data as TbaTeam);
				message.channel.send({ embeds: [embed] });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (error: any) {
				if (error.response?.status === 404) {
					send(message.channel, `Team ${teamNumber} doesn't exist. This is because FRC leaves some numbers unassigned.`);
				} else {
					handleTBAApiError(error);
				}
			}
		} else { // parameter is not valid
			send(message.channel, `${content} isn't a number between 1-${MAX_TEAM_NUMBER}.`);
		}
	},
);
