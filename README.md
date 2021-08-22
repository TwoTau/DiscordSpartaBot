# Discord SpartaBot

![GitHub top language](https://img.shields.io/github/languages/top/TwoTau/DiscordSpartaBot?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/TwoTau/DiscordSpartaBot?style=flat-square)
![GitHub contributors](https://img.shields.io/github/contributors/TwoTau/DiscordSpartaBot?style=flat-square)
![GitHub Repo stars](https://img.shields.io/github/stars/TwoTau/DiscordSpartaBot?style=flat-square)
![GitHub license](https://img.shields.io/github/license/TwoTau/DiscordSpartaBot?style=flat-square)

SpartaBot is a Discord bot made by [@TwoTau](https://github.com/twotau) using [discord.js](https://discord.js.org "discord.js home page"). This repository contains all the source code for the bot. If you want to fork this and run it yourself, follow the instructions in [Creating a config file](#creating-a-config-file).

## (Partial) List of commands

See the [commands folder](commands/) for a full list of commands.

### info `<optional mentioned member>`
Returns info about the mentioned member or if no member is mentioned, the author of the message.

Screenshot of `!info spartabot` (with discriminator and User ID removed):

![Screenshot of !info spartabot](https://user-images.githubusercontent.com/14433542/42710963-0e51097c-869b-11e8-8269-894292cb6d0d.png)

### repeat `<text>`
Repeats the message and then deletes the author's message.

### when `<event name>`
Will tell you how much time there is until an event. The events are specified in `config.events`.

Screenshot of `!when kickoff`:

![Screenshot of !when kickoff](https://user-images.githubusercontent.com/14433542/42711718-c513de26-869d-11e8-9c40-550f90764ec6.png)

### togglerole `<role name>`
Removes or adds a role from the author of the message. The role name must be in `config.toggleable_roles`;

### eval `<javascript code>`
Executes JavaScript. This command can only be used by the bot creator, specified by `config.bot_creator` and requires that `config.options.allow_eval_command` is true.

### purge `<number of messages>`
Delete the last _n_ comments. This command can only be used by admins, specified by `config.admin_role`. If `config.options.restrict_purge_to_bot_creator` is false, then this command can only be used by the bot creator.
The bot also sends a quote from the dystopian novels _Farenheit 451_ or _Nineteen Eighty-Four_ to discourage abuse of this command.

Screenshot of `!purge 30`:

![Screenshot of !purge 30](https://user-images.githubusercontent.com/14433542/31846961-eb1d036a-b5c7-11e7-98db-cbac1a0617f1.png)

### log `<optional name of person>`
Returns the history of the person's sign-ins and outs. This depends on the sign-in database being used (AKA `config.firebase_db_url`).

- _If argument is specified_
    - _If the author is an admin_
        - Sends partial data in the same channel.
        - Sends the full sign-in history in the same channel.
    - _Else (author not an admin)_
        - Sends partial data in the same channel.
- _Else (no argument is specified)_
    - Sends partial data in the same channel.
    - Direct messages the author their full sign-in history.

### tophours
Sends a list of the top nine people with the most hours.

Screenshot of `!tophours` with placeholder names and hours:

![Screenshot of !tophours](https://user-images.githubusercontent.com/14433542/42711996-d0bbd480-869e-11e8-9f34-5c7babf9d442.png)

### subtracthours `<name>` `<time>` `<optional date>`
Subtracts specified time from the person chosen. Subtract 0:00 hours to override the previous subtraction. The time argument must be in h:mm format and be between 0:01 and 23:59. The date argument, if specified, must be in M/D format.
SpartaBot also sends a Discord Webhook to log the subtracted hours. In this example, the webhook goes to the #logs channel.

Screenshot of `!subtracthours "Vishal Devireddy" "1:00"`:

![Screenshot of !subtracthours](https://user-images.githubusercontent.com/14433542/42712202-8a7ac9a8-869f-11e8-85a5-ce1d0aa39ca3.png)

### tbateam `<FRC team number>`
Returns information about a team using [TheBlueAlliance's API](https://www.thebluealliance.com/apidocs) given the team number.

Screenshot of `!tbateam 2976`:

![Screenshot of !tbateam 2976](https://user-images.githubusercontent.com/14433542/31847009-e2413b52-b5c8-11e7-9e96-357db9643aab.png)

### emoji `<emoji name>` `<optional number to repeat>`
Sends an animated emoji and deletes the author's message. Only works with animated emoji. The number to repeat can be between 1 and 10.

### kys
Terminates the program. This command can only be used by the bot creator.

### help `<optional command>`
Returns a list of the non-hidden commands along with a description and example usage of each.

Screenshot of `!help`:

![Screenshot of !help](https://user-images.githubusercontent.com/14433542/42710716-0730025c-869a-11e8-940e-88a1d76c9a66.png)

Screenshot of `!help tbateam`:

![Screenshot of !help tbateam](https://user-images.githubusercontent.com/14433542/31846913-2e1caf40-b5c7-11e7-82c8-8e017f8a7a9f.png)

## Creating a config file

You will need to create a `config.json` file in this folder with secret keys and tokens for SpartaBot. See [config-example.json](config-example.json) for a template. To find Discord user and channel IDs, [turn on Developer Mode](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-) in Discord.

You will also need a `serviceAccountKey.json` for accessing your Firebase database. You can download one from your Firebase project > Settings > Service accounts > Firebase Admin SDK.

The keys in `config.json` are:
- `discord_token`: The Discord bot token you find in the [Discord Developer panel](https://discordapp.com/developers/applications/me).
- `tba_auth_key`: TheBlueAlliance API key that you find in your [TheBlueAlliance account page](https://www.thebluealliance.com/account).

- `firebase_db_url`: The URL for the Firebase database that contains the sign-in data.
- `hours_log_webhook_url`: The Discord webhook URL to send subtract hours log messages to.

- `github_repo`: The ending part of the GitHub url for your fork of this repository. For example: `twotau/DiscordSpartaBot`.
- `debug_channel_id`: The Discord channel ID for a debug channel as a string. If this is specified, SpartaBot will send some logging messages to this channel.
- `bot_creator`: The Discord user ID for the creator of the bot. This is used for eval permission and when determining whether a user has permissions to do something.

- `new_member_role`: The Discord role ID of the role SpartaBot will assign to members that join the server.
- `other_team_role`: The Discord role ID of the role given to those of other teams. Users with this role are restricted in some ways, such as not being able to use the togglerole or log commands.
- `admin_role`: The Discord role ID of the role given to those that can mass purge messages (if `options.restrict_purge_to_bot_creator` is false) and have access to members' full hour logs.

- `options`: An object containing the following properties:
	- `prefix`: The characters that a message needs to start with for SpartaBot to recognize the message as a command. Common prefixes are `!` and `?`.
	- `allow_eval_command`: A boolean for whether SpartaBot can respond to the eval command if sent by the bot's owner. This is very dangerous because it allows the bot's owner to execute any code.
	- `enable_log_command`: A boolean for whether users can use the log command (should only be true for the build season).
	- `restrict_purge_to_bot_creator`: A boolean for whether only the bot creator can use the purge command. If false, anyone with the `admin_role` can use purge.

- `automated_message`: An object containing values relevant to automated messages:
	- `open_door_message`: The message to send when someone asks for the build room door to be opened.

- `toggleable_roles`: An object containing the name of the toggleable roles as the keys and the Discord role IDs (in string format) as the values.

- `events`: An object containing the short name of the events as the keys and objects (with the event name and ISO timestamp) as the values. For example:
	- _short argument name_: An argument for the when command.
		- `name`: The full name of the event.
		- `timestamp` the ISO date time. For example: "2018-02-20T20:59:00.000".
