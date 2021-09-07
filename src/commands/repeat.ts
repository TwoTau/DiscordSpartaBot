import Command from '../command';

const cmd = new Command(
	'repeat',
	'Will repeat your message then delete your message.',
	'repeat <text>',
	'repeat I am a good bot',
	async (message, content) => {
		message.delete();
		message.channel.send(content);
	},
);

cmd.hideFromHelp();

export default cmd;
