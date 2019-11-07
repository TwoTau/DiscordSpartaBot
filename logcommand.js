const firebaseAdmin = require('firebase-admin');
const Command = require('./command');
const config = require('./config.json');
const accountKey = require('./serviceAccountKey.json');

module.exports = class LogCommand extends Command {
	/**
	 * Initializes the FireBase database and members list
	 */
	static initialize() {
		firebaseAdmin.initializeApp({
			credential: firebaseAdmin.credential.cert(accountKey),
			databaseURL: config.firebase_db_url,
		});

		// database contains member sign in and outs
		LogCommand.db = firebaseAdmin.database();
		LogCommand.memberNameList = {};

		LogCommand.db.ref('members').once('value').then((snapshot) => {
			LogCommand.memberNameList = snapshot.val();
		});
	}
};
