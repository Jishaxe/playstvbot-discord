const Wit = require("node-wit").Wit
const util = require("./util")
const Embed = require('discord.js').RichEmbed

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
     * Validates the playstv username and channel
     * @param {Object} entities 
     * @param {Message} msg 
     */
    validate(entities, msg) {
        let self = this
        let results = {}
        results.missingUsername = entities.username == null
        results.channelText = entities.channel ? entities.channel[0].value.replace("#", ""): msg.channel.name
        results.usernameText = entities.username[0].value.trim()
        results.channel = util.matchChannel(results.channelText, msg.guild)
        results.invalidChannel = results.channel == null
        results.hasPermission = results.channel.permissionsFor(msg.client.user).hasPermission("SEND_MESSAGES")

        return this.playstv.users.get(results.usernameText)
        .then((user) => {
            results.user = user.user
            return self.database.getChannelsForEvent(user.id, "newVideo")
        })
        .then((channelsForThisUser) => {
            results.following = (channelsForThisUser && Object.keys(channelsForThisUser).filter((key) => channelsForThisUser[key] == channel.id).length > 0) 
        })
        .catch((err) => {
            if (err.indexOf && err.indexOf("404") !== -1) results.invalidUsername = true
            else throw err
        })
        .then(() => {
            return results
        })
    }

    /**
     * Handles the trackVideos command
     * @param {Object} entities 
     * @param {Message} msg 
     */
    trackVideos(entities, msg) {
        let self = this
        let data

        return this.validate(entities, msg).then((d) => {
            data = d
            if (data.missingUsername) return msg.reply("you need to specify a Plays.tv username to follow them.")
            if (data.invalidChannel) return msg.reply(`I don't know what channel #${data.channelText} is.`)
            if (!data.hasPermission) return msg.reply(`I don't have permission to speak in <#${data.channel.id}>.`)
            if (data.invalidUsername) return msg.reply(`I couldn't find the Plays.tv username **${data.usernameText}**.`)
            if (data.following) return msg.reply(`I'm already following **${data.user.id}** in <#${data.channel.id}>. You can tell me to unfollow them.`)

            // All checks passed, add this user to the database
            return self.database.trackVideos(data.user.id, data.channel.id)
        })
        .then(() => {
            let embed = new Embed();
            embed.setDescription(`I'll now post new videos from [${data.user.id}](${data.user.link}) in <#${data.channel.id}>. You can tell me to unfollow them too.`)
            embed.setTitle(`Followed!`)
            embed.setColor("#FFFFFF")
            embed.setThumbnail("http:" + data.user.avatar)
            return msg.channel.sendEmbed(embed)
        })
    }

    untrackVideos(entities, msg) {

    }
}

module.exports = Processor