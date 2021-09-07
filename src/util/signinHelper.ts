import * as firebaseAdmin from 'firebase-admin';
import { Message, MessageEmbed } from 'discord.js';
import * as moment from 'moment';
import { send } from './util';

function padStart(originalString: number | string, targetLength: number, padString = '0') {
	return (String(originalString)).padStart(targetLength, padString);
}

// h:m:s without no padding zeroes
function getTime() {
	const now = new Date();
	return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
}

// YYYY-MM-DD to MM/DD
function longDateToShort(longDate: string) {
	const dateArray = longDate.split('-'); // [YYYY, MM, DD]
	return `${dateArray[1]}/${dateArray[2]}`; // MM/DD
}

// h:m:s to hh:mm
function longTimeToShort(timeString: string) {
	const hms = timeString.split(':');
	return `${padStart(hms[0], 2)}:${padStart(hms[1], 2)}`;
}

// seconds to hh:mm
function secondsToFormattedTime(durationInSeconds: number) {
	const fullHoursElapsed = padStart(Math.floor(durationInSeconds / 3600), 2);
	const fullMinutesElapsed = padStart(Math.round((durationInSeconds % 3600) / 60), 2);
	return `${fullHoursElapsed}:${fullMinutesElapsed}`;
}

// h:m:s, h:m:s to seconds
function getTimeDiffInSeconds(startTime: string, endTime: string) {
	const startTimeArray = startTime.split(':');
	const endTimeArray = endTime.split(':');
	const hours = +endTimeArray[0] - +startTimeArray[0];
	const minutes = +endTimeArray[1] - +startTimeArray[1];
	const seconds = +endTimeArray[2] - +startTimeArray[2];
	return (hours * 3600) + (minutes * 60) + seconds;
}

type LogOutput = {
	totalTime: number;
	formattedTime: string;
	loggedIn: boolean;
	table: string;
}

type FirebaseMeetings = {
	[date: string]: {
		[startOrEndNum: string]: string;
	}
}

type FirebaseSubtractLog = {
	[date: string]: number;
}

export function getTimeLog(meetingsLog: FirebaseMeetings, subtractLog: FirebaseSubtractLog, shouldMakeTable = true): LogOutput {
	let totalTime = 0;
	let timeRows = '|| day | |start| | end | |hours||\n';
	let isStillLoggedIn = false;

	if (subtractLog) {
		for (const date of Object.keys(subtractLog)) {
			const day = longDateToShort(date);

			const timeSubtractedInSec = getTimeDiffInSeconds('0:0:0', `${subtractLog[date]}:0`);
			totalTime -= timeSubtractedInSec;

			const formattedTimeDiff = secondsToFormattedTime(timeSubtractedInSec);
			timeRows += `-|${day}| | >:( | | >:( | -${formattedTimeDiff}||\n`;
		}
	}

	if (meetingsLog) {
		for (const date of Object.keys(meetingsLog)) {
			const timesLog = meetingsLog[date];

			let i = 0;

			while (timesLog[`start${i}`]) {
				const day = longDateToShort(date);
				const formattedStartTime = shouldMakeTable ? longTimeToShort(timesLog[`start${i}`]) : '';

				if (timesLog[`end${i}`]) { // signed out that same day
					const endTime = timesLog[`end${i}`];
					const timeDiff = getTimeDiffInSeconds(timesLog[`start${i}`], endTime);
					totalTime += timeDiff;

					if (shouldMakeTable) {
						const formattedEndTime = longTimeToShort(endTime);
						const formattedTimeDiff = secondsToFormattedTime(timeDiff);

						timeRows += `||${day}| |${formattedStartTime}| |${formattedEndTime}| |${formattedTimeDiff}||\n`;
					}
				} else if (date === moment().format('YYYY-MM-DD')) { // not signed out but is same day
					// should count because under assumption they will log out
					isStillLoggedIn = true;

					const endTime = getTime();
					const timeDiff = getTimeDiffInSeconds(timesLog[`start${i}`], endTime);
					totalTime += timeDiff;

					if (shouldMakeTable) {
						const formattedEndTime = longTimeToShort(endTime);
						const formattedTimeDiff = secondsToFormattedTime(timeDiff);

						timeRows += `+|${day}| |${formattedStartTime}| |${formattedEndTime}| |${formattedTimeDiff}||\n`;
					}
				} else if (shouldMakeTable) { // not signed out and different day
					// should not count because they have not logged out that day
					timeRows += `+|${day}| |${formattedStartTime}| |  ~  | |00:00||\n`;
				}

				i += 1;
			}
		}
	}

	return {
		totalTime,
		formattedTime: secondsToFormattedTime(totalTime),
		loggedIn: isStillLoggedIn,
		table: timeRows,
	};
}

type FirebaseMember = {
	discordId: string;
	groups: string;
	present: boolean;
	requirements: {
		[req: string]: boolean;
	}
}

export type FirebaseMembers = {
	[name: string]: FirebaseMember;
}

export type UserExistOutput = {
	name: string;
	data: FirebaseMember;
	isBoardMember: boolean;
	groups: string[];
}

export function doesUserExist(allMembers: FirebaseMembers, username: string): UserExistOutput | null {
	const name = username.toLowerCase();
	for (const fullName of Object.keys(allMembers)) {
		if (fullName.toLowerCase() === name) {
			const groups = allMembers[fullName].groups.split(' ');
			return {
				name: fullName,
				data: allMembers[fullName],
				isBoardMember: groups.includes('board'),
				groups,
			};
		}
	}
	return null;
}
export function findUserFromDiscordId(allMembers: FirebaseMembers, discordId: string): UserExistOutput | false {
	for (const fullName of Object.keys(allMembers)) {
		if (allMembers[fullName].discordId === discordId) {
			const groups = allMembers[fullName].groups.split(' ');
			return {
				name: fullName,
				data: allMembers[fullName],
				isBoardMember: groups.includes('board'),
				groups,
			};
		}
	}
	return false;
}

export async function sendUserLog(db: firebaseAdmin.database.Database, message: Message, fullName: string, groups: string[], sendFullTimeTable: '' | 'in same channel' | 'in direct message' = ''): Promise<void> {
	const data = (await db.ref(`log/${fullName}`).once('value')).val();
	let log: LogOutput;
	let totalTimeInSec: number;
	if (data) {
		log = getTimeLog(data.meetings, data.subtract, Boolean(sendFullTimeTable));
		totalTimeInSec = log.totalTime;
	} else { // member has never signed in
		totalTimeInSec = 0;
	}

	const isBoardMember = groups.includes('board');
	let timeNeededInSec = 3600 * 40;
	if (isBoardMember) {
		timeNeededInSec = 3600 * 80;
	} else if (groups.includes('nonmember')) {
		timeNeededInSec = 3600 * 60;
	}
	const timeLeftFormatted = ((timeNeededInSec > totalTimeInSec) ? secondsToFormattedTime(timeNeededInSec - totalTimeInSec) : ':zero:');

	if (totalTimeInSec > 0) { // user has spent time
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const { formattedTime, loggedIn, table } = log!;

		const percentagePieChart = Math.round((totalTimeInSec / timeNeededInSec) * 100);
		const pieChartColor = (timeNeededInSec > totalTimeInSec) ? 'E26212' : '04C30E';

		const embed = new MessageEmbed()
			.setColor(isBoardMember ? 1277112 : 13421772)
			.setThumbnail(`https://quickchart.io/chart?c={type:%27radialGauge%27,options:{roundedCorners:false,centerPercentage:65,centerArea:{fontColor:%22rgb(200,200,200)%22}},data:{datasets:[{data:[${percentagePieChart}],backgroundColor:%22%23${pieChartColor}%22}]}}&w=256&h=256`)
			.addField('Board', (isBoardMember ? 'Yes' : 'No'), true)
			.addField('Hours needed', timeLeftFormatted, true)
			.setDescription(`**${fullName}** is currently **${loggedIn ? '' : 'not '}logged in**. They have **${formattedTime}** hours.`);
		message.channel.send({ embeds: [embed] });

		if (sendFullTimeTable === 'in same channel') {
			send(message.channel, `\`\`\`diff\n${table}\`\`\``);
		} else if (sendFullTimeTable === 'in direct message') {
			try {
				await message.author.send(`Your log:\n\`\`\`diff\n${table}\`\`\``);
				message.channel.send('Check your DMs. I sent you your full time log.');
			} catch {
				message.channel.send("I tried to send you a DM with your full time log, but there was an error. :unamused: It's possible that you blocked me or don't allow DMs from me.");
			}
		}
	} else { // user has not spent any time
		const embed = new MessageEmbed()
			.setColor(16132136)
			.setDescription(`**${fullName}** is not logged in and has :zero: **hours**. They still need to log **${timeLeftFormatted}**.`);
		message.channel.send({ embeds: [embed] });
	}
}

export type Correction = {
	name: string;
	request: string;
	date: string;
	submitted: moment.Moment;
}

export async function getCorrections(db: firebaseAdmin.database.Database): Promise<Correction[]> {
	const corrections = (await db.ref('corrections').once('value')).val();
	const toReturn = [];
	if (corrections) {
		for (const name of Object.keys(corrections)) {
			for (const submittedTime of Object.keys(corrections[name])) {
				toReturn.push({
					name,
					request: corrections[name][submittedTime].request,
					date: corrections[name][submittedTime].date,
					submitted: moment(submittedTime),
				});
			}
		}
	}
	return toReturn;
}
