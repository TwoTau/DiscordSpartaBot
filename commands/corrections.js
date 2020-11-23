const discord = require('discord.js');
const LogCommand = require('../logcommand');
const signinHelper = require('../util/signinHelper');
const { send, reply, isAuthorAdmin } = require('../util/util');

function sendCorrectionsInMessages(channel, corrections, correctionsPerMessage) {
	for (let p = 0; p < corrections.length; p += correctionsPerMessage) {
		const pageNum = `${(p / correctionsPerMessage) + 1}/${Math.ceil(corrections.length / correctionsPerMessage)}`;
		const embed = new discord.MessageEmbed()
			.setTitle(`Corrections (${pageNum})`)
			.setColor(0xF62828);
		const end = Math.min(p + correctionsPerMessage, corrections.length);
		for (let i = p; i < end; i++) {
			const { name, submitted, request, date } = corrections[i];
			embed.addField(`**${name}** @ (${submitted.format('M/D h:mm a')})`, `\`[${date}]\` - ${request}`);
		}
		channel.send({ embed });
	}
}

module.exports = new LogCommand(
	'corrections',
	'Will list all corrections or corrections from a specific person. Can only be used by admins.',
	'corrections <optional name of person>',
	'corrections Firstname Lastname',
	async (message, content) => {
		if (!isAuthorAdmin(message)) { // author is not an admin
			message.reply('Only admins can use this command.');
			return;
		}

		const name = content;
		let member;
		if (name) {
			member = signinHelper.doesUserExist(LogCommand.memberNameList, name);
			if (!member) { // member does not exist
				reply(message, `Sorry, I can't find "**${name}**" in the database.`);
				return;
			}
		}

		const correctionsData = await signinHelper.getCorrections(LogCommand.db);
		if (correctionsData.length === 0) {
			message.channel.send('There are no corrections.');
			return;
		}
		const corrections = correctionsData.sort((a, b) => (a.submitted.isBefore(b.submitted) ? -1 : 1));

		if (name) { // send only name's messages
			const filteredCorrections = corrections.filter((c) => c.name === member.name);
			if (filteredCorrections.length) {
				sendCorrectionsInMessages(message.channel, filteredCorrections, 3);
			} else {
				send(message.channel, `${member.name} has no corrections.`);
			}
		} else { // send everything
			sendCorrectionsInMessages(message.channel, corrections, 3);
		}
	},
);

module.exports.hideFromHelp();
