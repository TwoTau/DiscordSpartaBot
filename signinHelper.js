module.exports = {
	// in format YY-MM-DD with leading zeroes as applicable
	getDate: function() {
		const now = new Date();
		const year = now.getFullYear() - 2000;
		const month = ("" + (now.getMonth() + 1)).padStart(2, "0");
		const day = ("" + now.getDate()).padStart(2, "0");
		return year + "-" + month + "-" + day;
	},

	// h:m:s without no padding zeroes
	getTime: function() {
		const now = new Date();
		return now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
	},

	// YY-MM-DD to MM/DD
	longDateToShort: function(longDate) {
		const dateArray = longDate.split("-"); // [YY, MM, DD]
		return (dateArray[1]) + "/" + (dateArray[2]); // MM/DD
	},

	// h:m:s to hh:mm
	longTimeToShort: function(timeString) {
		const hms = timeString.split(":");
		return hms[0].padStart(2, "0") + ":" + hms[1].padStart(2, "0");
	},

	// seconds to hh:mm
	secondsToFormattedTime: function(durationInSeconds) {
		const fullHoursElapsed = ("" + Math.floor(durationInSeconds / 3600)).padStart(2, "0");
		const fullMinutesElapsed = ("" + Math.floor((durationInSeconds % 3600) / 60)).padStart(2, "0");
		return fullHoursElapsed + ":" + fullMinutesElapsed;
	},

	// h:m:s, h:m:s to seconds
	getTimeDiffInSeconds: function(startTime, endTime) {
		const startTimeArray = startTime.split(":");
		const endTimeArray = endTime.split(":");
		const hours = endTimeArray[0] - startTimeArray[0];
		const minutes = endTimeArray[1] - startTimeArray[1];
		const seconds = endTimeArray[2] - startTimeArray[2];
		return (hours * 3600) + (minutes * 60) + seconds;
	},

	getTimeLog(meetingsLog, shouldMakeTable=true) {
		let totalTime = 0;
		let timeRows = "|| day | |start| | end | |hours||\n";
		let isStillLoggedIn = false;

		for(const date in meetingsLog) {
			const timesLog = meetingsLog[date];

			for(let i = 0; i < 10; ++i) {
				if(timesLog["start"+i]) {
					const day = this.longDateToShort(date);
					const formattedStartTime = shouldMakeTable ? this.longTimeToShort(timesLog["start"+i]) : "";

					if(timesLog["end"+i]) { // signed out that same day
						const endTime = timesLog["end"+i];
						const timeDiff = this.getTimeDiffInSeconds(timesLog["start"+i], endTime);
						totalTime += timeDiff;

						if(shouldMakeTable) {
							const formattedEndTime = this.longTimeToShort(endTime);
							const formattedTimeDiff = this.secondsToFormattedTime(timeDiff);

							timeRows += `||${day}| |${formattedStartTime}| |${formattedEndTime}| |${formattedTimeDiff}||\n`;
						}
					} else { // has/had not signed out
						const TODAY = this.getDate();
						if(date === TODAY) { // should count because under assumption they will log out
							isStillLoggedIn = true;

							const endTime = this.getTime();
							const timeDiff = this.getTimeDiffInSeconds(timesLog["start"+i], endTime);
							totalTime += timeDiff;

							if(shouldMakeTable) {
								const formattedEndTime = this.longTimeToShort(endTime);
								const formattedTimeDiff = this.secondsToFormattedTime(timeDiff);

								timeRows += `||${day}| |${formattedStartTime}| |${formattedEndTime}| |${formattedTimeDiff}||\n`;
							}
						} else if(shouldMakeTable) { // should not count because they have not logged out that day
							timeRows += `||${day}| |${formattedStartTime}| |  ~  | |00:00||\n`;
						}
					}
				}
			}
		}

		return {
			totalTime: totalTime,
			formattedTime: this.secondsToFormattedTime(totalTime),
			loggedIn: isStillLoggedIn,
			table: timeRows
		};
	},

	doesUserExist: function(allMembers, username) {
		const name = username.toLowerCase();
		for(const fullName in allMembers) {
			if(fullName.toLowerCase() === name) {
				return {
					name: fullName,
					data: allMembers[fullName]
				};
			}
		}
		return false;
	},

	findUserFromDiscordId: function(allMembers, discordId) {
		for(const fullName in allMembers) {
			if(allMembers[fullName].discordId === discordId) {
				return {
					name: fullName,
					isBoardMember: allMembers[fullName].board
				};
			}
		}
		return false;
	},

	// sendFullTimeTable must be either false, "in direct message", "in same channel"
	sendUserLog: function(db, message, fullName, isBoardMember, sendFullTimeTable=false) {
		db.ref(`log/${fullName}/meetings`).once("value", snapshot => {
			const meetingsLog = snapshot.val();

			const log = this.getTimeLog(meetingsLog, sendFullTimeTable);
			const totalTimeInSec = log.totalTime;
			const timeNeededInSec = (isBoardMember ? 216000 : 144000);
			const timeLeftFormatted = ((timeNeededInSec > totalTimeInSec) ? this.secondsToFormattedTime(timeNeededInSec - totalTimeInSec) : ":zero:");

			if(totalTimeInSec > 0) { // user has spent time
				const totalTime = log.formattedTime;
				const loggedIn = log.loggedIn;
				const timeRows = log.table;

				message.channel.send(`**${fullName}** is currently **${loggedIn ? "" : "not "}logged in**. They have **${totalTime}** hours and need **${timeLeftFormatted}** hours.`);
				if(sendFullTimeTable === "in same channel") {
					message.channel.send("`" + timeRows + "`");
				} else if(sendFullTimeTable === "in direct message") {
					message.author.send("Your log:\n`" + timeRows + "`").then(() => {
						message.channel.send("Check your DMs. I sent you your full timelog.");
					}).catch(() => {
						message.channel.send("I tried to send you a DM with your full timelog, but there was an error. :unamused: It's possible that you blocked me or don't allow DMs from me.");
					});
				}
			} else { // user has not spent any time
				message.channel.send(`**${fullName}** is not logged in and has **0 hours**. They should come more often, because they still have **${timeLeftFormatted}** time left.`);
			}
		});
	}
};