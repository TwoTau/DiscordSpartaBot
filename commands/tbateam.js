const Command = require("../command");
const config = require("../config.json");
const discord = require("discord.js");
const request = require("request");

module.exports = new Command(
	"tbateam",
	"Will give you information about a team given the team number.",
	"tbateam <teamnumber t where t ∈ ℤ ∩ [1,7999]>",
	"tbateam 2976",
	function (message, content) {
		if (!content) { // no parameter
			message.channel.send("You need to specify a team number (1-7999).");
			return;
		}

		if (+content > 0 && +content <= 7999) { // parameter is valid
			// send a request to TheBlueAlliance's API for team information
			request({
				url: `http://www.thebluealliance.com/api/v3/team/frc${+content}?X-TBA-Auth-Key=${config.tba_auth_key}`,
				json: true
			}, (error, response, body) => {

				// page could not be found, so the team does not exist
				if (response.statusCode === 404) {
					message.channel.send(`Team ${+content} doesn't exist.`);
					return;
				}

				// did not receive an OK status code
				if (error || response.statusCode !== 200) {
					message.channel.send("Something went wrong with using TheBlueAlliance's API");
					return;
				}

				const motto = body.motto ? `"${body.motto}"` : "_none_";
				const location = body.city ? `${body.city}, ${body.state_prov}` : "unknown";
				const nickname = body.nickname || "";

				const embed = new discord.RichEmbed()
					.setTitle(`FRC Team ${body.team_number}: ${nickname}`)
					.setURL(`https://www.thebluealliance.com/team/${body.team_number}`)
					.setColor(0x12C40F)
					.addField("Team number", body.team_number, true)
					.addField("Nickname", nickname, true)
					.addField("Location", location, true)
					.addField("Motto", motto, true)
					.addField("Website", body.website || "_none_", true);

				message.channel.send({ embed });
			});

		} else { // parameter is not valid
			message.channel.send(`${content} is not a number between 1-7999.`);
		}
	}
);