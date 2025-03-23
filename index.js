require('dotenv').config()
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
} = require("@discordjs/voice");

const { generateDependencyReport } = require('@discordjs/voice');

console.log(generateDependencyReport());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}
// client.on(Events.MessageCreate, interaction => {
//     //if (!interaction.isChatInputCommand()) return;
//
//     const { content } = interaction;
//
//     if (content === 'ping') {
//         interaction.reply('Pong.');
//     } else if (content === 'beep') {
//         interaction.reply('Boop.');
//     } else if (content === 'server') {
//         interaction.reply('Guild name: ' + interaction.guild.name + '\nTotal members: ' + interaction.guild.memberCount);
//     } else if (content === 'user-info') {
//         interaction.reply('Your username: ' + interaction.author.username + '\nYour ID: ' + interaction.author.id);
//     }
// });

const monitoredUsers = new Map();
const player = createAudioPlayer();

const getCommadsStringMessage = () => {
    return `🤖 **Comandos disponibles**:` +
        `\n- **!commands**: Muestra los comandos disponibles.` +
        `\n- **!im @usuario**: Convierte a un usuario en Invincible.` +
        `\n- **!inservible @usuario**: Convierte a un usuarin en inservible.` +
        `\n- **!inservible**: Convierte todos en inservibles.` +
        `\n- **!whoisinvincible**: Muestra los usuarios Invincible.`;
}


client.on(Events.MessageCreate, async (message) => {
    if (!message.guild) return;

    if (message.content.toLowerCase().startsWith("!whoisinvincible")) {
        const guildData = monitoredUsers.get(message.guild.id);

        if (!guildData || guildData.users.length === 0) {
            return message.reply("❌ Nadie es Invencible en este servidor.");
        }

        const userList = guildData.users
            .map(userId => {
                const user = message.guild.members.cache.get(userId);
                return user ? `- **${user.displayName}**` : `- **ID:** ${userId}`;
            })
            .join("\n");

        message.reply(`🦸‍♂️ Actualmente ell@s son Invincible:\n${userList}`);
        return;
    }

    if (message.content.startsWith("!im")) {
        const args = message.mentions.users;

        if (!args.size) return message.reply("Debes mencionar al menos un usuario para convertirlo en Invincible.");

        const channel = message.member.voice.channel;
        if (!channel) return message.reply("¡Debes estar en un canal de voz!");

        let connection = monitoredUsers.get(message.guild.id)?.connection;
        if (!connection) {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            connection.receiver.speaking.on("start", async (speakingUserId) => {
                const users = monitoredUsers.get(message.guild.id)?.users || [];
                if (users.includes(speakingUserId)) {
                    console.log(`🔊 Invencible con ID ${speakingUserId} está hablando.`);
                    // message.channel.send(`🔊 **${message.guild.members.cache.get(speakingUserId)?.displayName}** está hablando.`);

                    // const userToMute = message.guild.members.cache.get(speakingUserId);
                    // if (userToMute) {
                    //     try {
                    //         await userToMute.voice.setMute(true);
                    //         console.log(`🔇 Usuario ${userToMute.displayName} ha sido muteado.`);
                    //     } catch (error) {
                    //         console.error("Error al mutear al usuario:", error);
                    //     }
                    // }

                    const audioPath = path.join(__dirname, "invincible.mp3");
                    const resource = createAudioResource(audioPath);
                    connection.subscribe(player);
                    player.play(resource);
                }
            });
        }

        const usersToMonitor = monitoredUsers.get(message.guild.id)?.users || [];
        args.forEach(user => {
            if (!usersToMonitor.includes(user.id)) {
                usersToMonitor.push(user.id);
            }
        });

        monitoredUsers.set(message.guild.id, { connection, users: usersToMonitor });

        message.reply(`🦸‍♂️🔊 Has convertido a ${args.map(u => `**${u.username}**`).join(", ")} en Invincible.`);
    }

    if (message.content.startsWith("!inservible")) {
        const args = message.mentions.users;
        const guildData = monitoredUsers.get(message.guild.id);

        if (!guildData) {
            return message.reply("❌ Nadie es Invencible en este servidor.");
        }

        if (args.size) {
            guildData.users = guildData.users.filter(userId => !args.has(userId));

            if (guildData.users.length === 0) {
                guildData.connection.destroy();
                monitoredUsers.delete(message.guild.id);
                return message.reply("❌ Nadie es Invencible en este servidor.");
            } else {
                monitoredUsers.set(message.guild.id, guildData);
                message.reply(`✅ ${args.map(u => `**${u.username}**`).join(", ")} Dejaron de ser Invincible.`);
            }
        } else {
            guildData.connection.destroy();
            monitoredUsers.delete(message.guild.id);
            message.reply("❌ Todos han dejado de ser Invincible.");
        }
    }

    if (message.content.startsWith("!commands")) {
        const commands = getCommadsStringMessage();

        message.reply(commands);
    }
});

// client.on("guildCreate", (guild) => {
//     const channelGuild = guild.channels.cache.find(ch => ch.isTextBased);
//     const channel = guild.channels.cache.first();
//     if (channel) {
//         channel.send("¡Hola! Acabo de unirme a este servidor. ¡I'm Invincible! 💥");
//         channel.send(getCommadsStringMessage());
//     }
// });

client.login(process.env.DISCORD_TOKEN)
