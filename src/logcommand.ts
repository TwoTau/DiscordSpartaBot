import * as firebaseAdmin from 'firebase-admin';
import Command from './command';
import { config } from './util/util';
import * as accountKey from './serviceAccountKey.json';
import { FirebaseMembers } from './util/signinHelper';

class LogCommand extends Command {
	static db: firebaseAdmin.database.Database;

	static memberNameList: FirebaseMembers;

	/**
	 * Initializes the FireBase database and members list
	 */
	static async initialize(): Promise<void> {
		firebaseAdmin.initializeApp({
			credential: firebaseAdmin.credential.cert(accountKey as firebaseAdmin.ServiceAccount),
			databaseURL: config.get('firebase_db_url') as string,
		});

		// database contains member sign in and outs
		LogCommand.db = firebaseAdmin.database();
		LogCommand.memberNameList = {};

		const snapshot = await LogCommand.db.ref('members').once('value');
		LogCommand.memberNameList = snapshot.val() as FirebaseMembers;
	}
}

export default LogCommand;
