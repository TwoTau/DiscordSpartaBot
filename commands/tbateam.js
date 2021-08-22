const axios = require('axios');
const discord = require('discord.js');
const moment = require('moment');
const Command = require('../command');
const { send, config } = require('../util/util');

const MAX_TEAM_NUMBER = 9000;

const authParams = {
	params: {
		'X-TBA-Auth-Key': config.get('tba_auth_key'),
	},
};

const API_DATE_FORMAT = 'YYYY-MM-DD';

function handleTBAApiError(error) {
	if (error.response) {
		Command.debug(`Something went wrong with using TBA's API.\nError ${error.response.status}`);
	} else {
		Command.debug(`Something went wrong.\nError:\n${error.message}`);
	}
}

async function addAwardsToEmbed(embed, teamNumber) {
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

function compareDates(a, b) {
	return moment(a.start_date, API_DATE_FORMAT).isAfter(moment(b.start_date, API_DATE_FORMAT)) ? -1 : 1;
}

async function addEventsToEmbed(embed, teamNumber) {
	let response;
	try {
		response = await axios.get(`http://www.thebluealliance.com/api/v3/team/frc${teamNumber}/events/simple`, authParams);
	} catch (error) {
		handleTBAApiError(error);
		return;
	}

	if (response.data.length > 0) {
		// get 5 most recent events
		const mostRecentEvents = response.data.sort(compareDates).slice(0, 5).map((event) => {
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

async function makeEmbed(data) {
	const teamNumber = data.team_number;
	const motto = data.motto ? `"${data.motto}"` : '_none_';
	const location = data.city ? `${data.city}, ${data.state_prov}` : 'unknown';
	const nickname = data.nickname || '';

	const embed = new discord.MessageEmbed()
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

module.exports = new Command(
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
				const embed = await makeEmbed(response.data);
				message.channel.send({ embeds: [embed] });
			} catch (error) {
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
