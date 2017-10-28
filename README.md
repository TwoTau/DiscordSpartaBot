# Discord SpartaBot

SpartaBot is a Discord bot made by Vishal using [discord.js](https://discord.js.org "discord.js home page"). This repository contains all the source code for the bot. If you want to fork this and run it yourself, follow the instructions in [Creating a config file](#creating-a-config-file).

## List of commands

### info `<optional mentioned member>`
Returns info about the mentioned member or if no member is mentioned, the author of the message.

Screenshot of `!info spartabot` (with discriminator and User ID removed):

![Screenshot of !info spartabot](https://user-images.githubusercontent.com/14433542/31846949-a10f5660-b5c7-11e7-891f-608a22cd4937.png)

### repeat `<text>`
Repeats the message and then deletes the author's message.

### togglerole `<role name>`
Removes or adds a role from the author of the message. The role name must be in `config.toggleable_roles`;

### eval `<javascript code>`
Executes JavaScript. This command can only be used by the bot creator, specified by `config.bot_creator_user_id` and requires that `config.allow_eval_command` is `true`.

### purge `<number of messages>`
Delete the last _n_ comments. This command can only be used by admins, specified by `config.admin_role`.
The bot also sends a quote from the dystopian novels _Farenheit 451_ or _Nineteen Eighty-Four_ to discourage abuse of this command.

Screenshot of `!purge 30`:

![Screenshot of !purge 30](https://user-images.githubusercontent.com/14433542/31846961-eb1d036a-b5c7-11e7-98db-cbac1a0617f1.png)

### log `<optional name of person>`
Returns the history of the person's sign-ins and outs.This depends on the sign-in database being used (AKA `config.firebase_db_url`).

- _If argument is specified_
    - _If the author is an admin_
        - Sends partial data in the same channel.
        - Sends the full sign-in history in the same channel.
    - _Else (author not an admin)_
        - Sends partial data in the same channel.
- _Else (no argument is specified)_
    - Sends partial data in the same channel.
    - Direct messages the author their full sign-in history.

### tbateam `<FRC team number>`
Returns information about a team using [TheBlueAlliance's API](https://www.thebluealliance.com/apidocs) given the team number.

Screenshot of `!tbateam 2976`:

![Screenshot of !tbateam 2976](https://user-images.githubusercontent.com/14433542/31847009-e2413b52-b5c8-11e7-9e96-357db9643aab.png)

### kys
Terminates the program. This command can only be used by the bot creator.

### help `<optional command>`
Returns a list of the non-hidden commands along with a description and example usage of each.

Screenshot of `!help`:

![Screenshot of !help](https://user-images.githubusercontent.com/14433542/31846905-fc457998-b5c6-11e7-96ba-03c43a5454e9.png)

Screenshot of `!help tbateam`:

![Screenshot of !help tbateam](https://user-images.githubusercontent.com/14433542/31846913-2e1caf40-b5c7-11e7-82c8-8e017f8a7a9f.png)


## Creating a config file

You will need to create a `config.json` file in this folder with secret keys and tokens for SpartaBot. View [config-example.json]() for a template. To find Discord user and channel IDs, [turn on Developer Mode](https://discordia.me/developer-mode) in Discord.

The keys in `config.json` are:
- `discord_token`: the Discord bot token you find in the [Discord Developer panel](https://discordapp.com/developers/applications/me).
- `tba_auth_key`: TheBlueAlliance API key that you find in your [TheBlueAlliance account page](https://www.thebluealliance.com/account).
- `firebase_db_url`: The URL for the Firebase database that contains the sign-in data.
- `github_repo`: The ending part of the GitHub url for your fork of this repository. For example: `twotau/DiscordSpartaBot`.
- `allow_eval_command`: A boolean for whether SpartaBot can respond to the eval command if sent by the bot's owner. This is very dangerous because it allows the bot's owner to execute any code.
- `prefix`: The characters that a message needs to start with for SpartaBot to recognize the message as a command. Common prefixes are `!` and `?`.
- `debug_channel_id`: The Discord channel ID for a debug channel as a string. If this is specified, SpartaBot will send some logging messages to this channel.
- `bot_creator_user_id`: The Discord user ID for the creator of the bot. This is used for eval permission and when determining whether a user has permissions to do something.
- `toggleable_roles`: an object containing the name of the toggleable roles as the keys and the Discord role IDs (in string format) as the values.
- `new_member_role`: The Discord role ID for the role SpartaBot assigns to members that join the server.
- `admin_role`: The Discord role _name_ of the role given to those that can mass purge messages and have access to members' full hour logs.
- `avatar_url`: Path to a local image file that Discord accepts for avatars. Example: `spartabots-logo.png`.
