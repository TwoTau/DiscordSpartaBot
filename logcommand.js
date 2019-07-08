const Command = require("./command");
const config = require("./config.json");
const firebaseAdmin = require("firebase-admin");

module.exports = class LogCommand extends Command {
	
	/**
	 * @extends Command
	 */
	constructor(name, description, usage, exampleUsage, execute) {
		super(name, description, usage, exampleUsage, execute);
	}

	/**
	 * Initializes the FireBase database and members list
	 */
	static initialize() {
		const accountKey = require("./serviceAccountKey.json");
		firebaseAdmin.initializeApp({
			credential: firebaseAdmin.credential.cert(accountKey),
			databaseURL: config.firebase_db_url
		});

		// database contains member sign in and outs
		LogCommand.db = firebaseAdmin.database();
		LogCommand.memberNameList = {};

		LogCommand.db.ref("members").once("value", snapshot => {
			LogCommand.memberNameList = snapshot.val();
		});
	}
	
};