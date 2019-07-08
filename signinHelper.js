const discord = require("discord.js");

function padStart(originalString, targetLength, padString = "0") {
	return ("" + originalString).padStart(targetLength, padString);
}

// in format YY-MM-DD with leading zeroes as applicable
function getDate() {
	const now = new Date();
	const year = now.getFullYear() - 2000;
	const month = padStart(now.getMonth() + 1, 2);
	const day = padStart(now.getDate(), 2);
	return year + "-" + month + "-" + day;
}

// h:m:s without no padding zeroes
function getTime() {
	const now = new Date();
	return now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
}

// YY-MM-DD to MM/DD
function longDateToShort(longDate) {
	const dateArray = longDate.split("-"); // [YY, MM, DD]
	return (dateArray[1]) + "/" + (dateArray[2]); // MM/DD
}

// h:m:s to hh:mm
function longTimeToShort(timeString) {
	const hms = timeString.split(":");
	return padStart(hms[0], 2) + ":" + padStart(hms[1], 2);
}

// seconds to hh:mm
function secondsToFormattedTime(durationInSeconds) {
	const fullHoursElapsed = padStart(Math.floor(durationInSeconds / 3600), 2);
	const fullMinutesElapsed = padStart(Math.round((durationInSeconds % 3600) / 60), 2);
	return fullHoursElapsed + ":" + fullMinutesElapsed;
}

// h:m:s, h:m:s to seconds
function getTimeDiffInSeconds(startTime, endTime) {
	const startTimeArray = startTime.split(":");
	const endTimeArray = endTime.split(":");
	const hours = endTimeArray[0] - startTimeArray[0];
	const minutes = endTimeArray[1] - startTimeArray[1];
	const seconds = endTimeArray[2] - startTimeArray[2];
	return (hours * 3600) + (minutes * 60) + seconds;
}

module.exports = {
	getTimeLog(meetingsLog, subtractLog, shouldMakeTable = true) {
		let totalTime = 0;
		let timeRows = "|| day | |start| | end | |hours||\n";
		let isStillLoggedIn = false;

		for (const date in subtractLog) {
			const day = longDateToShort(date);

			const timeSubtractedInSec = getTimeDiffInSeconds("0:0:0", subtractLog[date] + ":0");
			totalTime -= timeSubtractedInSec;

			const formattedTimeDiff = secondsToFormattedTime(timeSubtractedInSec);
			timeRows += `-|${day}| | >:( | | >:( | -${formattedTimeDiff}||\n`;
		}

		for (const date in meetingsLog) {
			const timesLog = meetingsLog[date];

			for (let i = 0; i < 10; ++i) {
				if (timesLog["start" + i]) {
					const day = longDateToShort(date);
					const formattedStartTime = shouldMakeTable ? longTimeToShort(timesLog["start" + i]) : "";

					if (timesLog["end" + i]) { // signed out that same day
						const endTime = timesLog["end" + i];
						const timeDiff = getTimeDiffInSeconds(timesLog["start" + i], endTime);
						totalTime += timeDiff;

						if (shouldMakeTable) {
							const formattedEndTime = longTimeToShort(endTime);
							const formattedTimeDiff = secondsToFormattedTime(timeDiff);

							timeRows += `||${day}| |${formattedStartTime}| |${formattedEndTime}| |${formattedTimeDiff}||\n`;
						}
					} else { // has/had not signed out
						const TODAY = getDate();
						if (date === TODAY) { // should count because under assumption they will log out
							isStillLoggedIn = true;

							const endTime = getTime();
							const timeDiff = getTimeDiffInSeconds(timesLog["start" + i], endTime);
							totalTime += timeDiff;

							if (shouldMakeTable) {
								const formattedEndTime = longTimeToShort(endTime);
								const formattedTimeDiff = secondsToFormattedTime(timeDiff);

								timeRows += `+|${day}| |${formattedStartTime}| |${formattedEndTime}| |${formattedTimeDiff}||\n`;
							}
						} else if (shouldMakeTable) { // should not count because they have not logged out that day
							timeRows += `+|${day}| |${formattedStartTime}| |  ~  | |00:00||\n`;
						}
					}
				}
			}
		}

		return {
			totalTime: totalTime,
			formattedTime: secondsToFormattedTime(totalTime),
			loggedIn: isStillLoggedIn,
			table: timeRows
		};
	},

	doesUserExist: function (allMembers, username) {
		const name = username.toLowerCase();
		for (const fullName in allMembers) {
			if (fullName.toLowerCase() === name) {
				return {
					name: fullName,
					data: allMembers[fullName]
				};
			}
		}
		return false;
	},

	findUserFromDiscordId: function (allMembers, discordId) {
		for (const fullName in allMembers) {
			if (allMembers[fullName].discordId === discordId) {
				return {
					name: fullName,
					isBoardMember: allMembers[fullName].board
				};
			}
		}
		return false;
	},

	// sendFullTimeTable must be either false, "in direct message", "in same channel"
	sendUserLog: function (db, message, fullName, isBoardMember, sendFullTimeTable = false) {
		db.ref(`log/${fullName}`).once("value", snapshot => {
			const data = snapshot.val();
			let log;
			let totalTimeInSec;
			if (data) {
				log = this.getTimeLog(data.meetings, data.subtract, sendFullTimeTable);
				totalTimeInSec = log.totalTime;
			} else { // member has never signed in
				totalTimeInSec = 0;
			}
			const timeNeededInSec = (isBoardMember ? 288000 : 144000);
			const timeLeftFormatted = ((timeNeededInSec > totalTimeInSec) ? secondsToFormattedTime(timeNeededInSec - totalTimeInSec) : ":zero:");

			if (totalTimeInSec > 0) { // user has spent time
				const totalTime = log.formattedTime;
				const loggedIn = log.loggedIn;
				const timeRows = log.table;

				const percentagePieChart = Math.round(totalTimeInSec / timeNeededInSec * 100);
				const pieChartColor = (timeNeededInSec > totalTimeInSec) ? "E26212" : "04C30E";

				const embed = new discord.RichEmbed()
					.setColor(isBoardMember ? 0x137CB8 : 0xCCCCCC)
					.setThumbnail(`https://quickchart.io/chart?c={type:%27radialGauge%27,options:{roundedCorners:false,centerPercentage:65,centerArea:{fontColor:%22rgb(200,200,200)%22}},data:{datasets:[{data:[${percentagePieChart}],backgroundColor:%22%23${pieChartColor}%22}]}}&w=256&h=256`)
					.addField("Board", (isBoardMember ? "Yes" : "No"), true)
					.addField("Hours needed", timeLeftFormatted, true)
					.setDescription(`**${fullName}** is currently **${loggedIn ? "" : "not "}logged in**. They have **${totalTime}** hours.`);
				message.channel.send({ embed });

				if (sendFullTimeTable === "in same channel") {
					message.channel.send("```diff\n" + timeRows + "```");
				} else if (sendFullTimeTable === "in direct message") {
					message.author.send("Your log:\n```diff\n" + timeRows + "```").then(() => {
						message.channel.send("Check your DMs. I sent you your full timelog.");
					}).catch(() => {
						message.channel.send("I tried to send you a DM with your full timelog, but there was an error. :unamused: It's possible that you blocked me or don't allow DMs from me.");
					});
				}
			} else { // user has not spent any time

				const embed = new discord.RichEmbed()
					.setColor(0xF62828)
					.setDescription(`**${fullName}** is not logged in and has :zero: **hours**. They still need to log **${timeLeftFormatted}**.`);
				message.channel.send({ embed });
			}
		});
	}
};
