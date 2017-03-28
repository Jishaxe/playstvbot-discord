const Wit = require("node-wit").Wit
const util = require("./util")

/**
 * Processes commands using Wit.ai
 */
class Processor {
    /**
     * 
     * @param {String} accessToken Wit.ai token 
     * @param {Database} database Database instance 
     * @param {PlaysTV} playstv PlaysTV API instance
     */
    constructor (accessToken, database, playstv) {
        this.wit = new Wit({accessToken})
        this.database = database
        this.playstv = playstv
    }

    /**
     * Process a message
     * @param {Message} msg 
     */
    handle(msg) {
        console.log(`${msg.author.username} in ${msg.guild ? msg.guild.name:"direct"}#${msg.channel.name ? msg.channel.name:"message"}: ${msg.content}`)

        // Don't do anything if the bot sent this message
        if (msg.author === msg.client.user) return Promise.resolve()

        if (!msg.guild) return msg.reply("You can only use me in a server.")

        // Don't do anything if the bot was not mentioned and the text began with @
        if (!msg.isMentioned(msg.client.user) || !msg.cleanContent.startsWith("@")) return Promise.resolve()

        // Clean up the text for witai
        let text = msg.cleanContent
        text = text.substring(0, 100)
        text = text.replace("@" + msg.client.user.username, "")

        // Send the message to witai and process the answer
        return this.wit.message(text).then((data) => this.action(data, msg))
    }

    /**
     * Take action on a wit.ai response
     * @param {Object} data 
     * @param {Message} msg The message to action
     */
    action(data, msg) {
        console.log(JSON.stringify(data))

        // If no intent was supplied, then it must have been a horrible message
        if (data.entities.intent[0].confidence < 0.6) return msg.reply(`**I don't understand that message.** You can do _<@${msg.client.user.id}> help._`)

        switch (data.entities.intent[0].value) {
            case "trackVideos": return this.trackVideos(data.entities, msg)
            case "untrackVideos": return this.untrackVideos(data.entities, msg)
        }
    }

    /**
     * Handles the trackVideos command
     * @param {Object} entities 
     * @param {Message} msg 
     */
    trackVideos(entities, msg) {
        // Fail if no username is found
        if (!entities.username) return msg.reply("you need to specify a Plays.tv username to follow them.")
        
        let id = entities.username[0].value.trim()

        // If a channel is specified, try and match the closest channel to compensate for typos
        // Otherwise, choose the channel the msg is in 
        let channelName = entities.channel ? entities.channel[0].value.replace("#", ""): msg.channel.name
        let channel = util.matchChannel(channelName, msg.guild)

        if (!channel) return msg.reply(`I don't know what channel #${channelName} is.`)
        
        // Check the bot has permission to speak in that channel
        if (!channel.permissionsFor(msg.client.user).hasPermission("SEND_MESSAGES")) return msg.reply(`I don't have permission to speak in <#${channel.id}>.`)

        // Now check plays.tv username
        return this.playstv.users.get(id).then((user) => msg.reply(`I'll now post new videos from **${id}** in <#${channel.id}>. You can tell me to unfollow them too.`))
        .catch((err) => msg.reply(`${err} I couldn't find the Plays.tv username **${id}**.`))

    }

    untrackVideos(entities, msg) {

    }
}

module.exports = Processor