const Command = require("../command");
const LogCommand = require("../logcommand");
const config = require("../config.json");
const discord = require("discord.js");
const moment = require("moment");
const signinHelper = require("../signinHelper");
const util = require("util");

module.exports = new Command(
	"eval",
	"Executes JavaScript in a very unsafe manner. Can only be used by the bot creator.",
	"just don't",
	":regional_indicator_n: :o2:",
	function (message, content) {
		if (!(Command.isAuthorBotCreator(message) && config.options.allow_eval_command)) {
			message.channel.send(":expressionless: :regional_indicator_n: :o2: :unamused:");
			return;
		}

		try {
			let evaled = eval(content);
			if (typeof (evaled) !== "string") {
				evaled = util.inspect(evaled);
			}
			if (typeof (evaled) === "string") {
				evaled = evaled.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
			}
			evaled = evaled.substring(0, 1950);
			message.channel.send(evaled, { code: "xl" }).catch(() => {
				Command.debug("Eval result was empty");
			});
		} catch (error) {
			let errText = error;
			if (typeof (error) === "string") {
				errText = error.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
			}
			message.channel.send("`ERROR` ```xl\n" + errText + "\n```");
		}
	}
);

module.exports.hideFromHelp();