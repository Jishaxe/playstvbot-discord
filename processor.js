const Wit = require("node-wit").Wit
const util = require("./util")
const Embed = require('discord.js').RichEmbed
const numberToWords = require("number-to-words")

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
        text = text.replace("@" + msg.client.user.username, "").trim()

        console.log(text)
        if (text == "help") {
            let embed = new Embed()
            embed.setAuthor("Created by jshxe", "https://cdn.discordapp.com/avatars/227874586312704000/316cee9c84be6297bbb3d423ef866dac.jpg")
            .setTitle("Plays.tv Beta")
            .setColor("#FFFFFF")
            .setThumbnail("https://images.discordapp.net/avatars/294914644961656832/d3d996e038b5a4b98b785a05b9fd0b8e.png?size=1024")
            .setDescription(`I'll keep you updated with new videos from your favourite Plays.tv creators. Control me with natural language. Try:\n\n\`\`\`@Plays.tv follow jshxe in #general\`\`\``)
            .addField("➕ Want me?", `[Add me](https://discordapp.com/oauth2/authorize?&client_id=${msg.client.user.id}&scope=bot)`, true)
            .addField("📓 GitHub", "[View Source](https://github.com/Jishaxe/playstvbot-discord)", true)
            .setFooter(`🖥️ Active on ${numberToWords.toWords(msg.client.guilds.size)} servers`)
            return msg.channel.sendEmbed(embed)
        }

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
        results.usernameText = entities.username ? entities.username[0].value.trim() : null
        results.channel = util.matchChannel(results.channelText, msg.guild)
        results.invalidChannel = results.channel == null
        results.hasPermission = results.channel.permissionsFor(msg.client.user).hasPermission("SEND_MESSAGES")

        return this.playstv.users.get(results.usernameText)
        .then((user) => {
            results.user = user.user
            return self.database.getChannelsForEvent(results.user.id, "newVideo")
        })
        .then((channelsForThisUser) => {
            results.following = (channelsForThisUser !== null
            && Object.keys(channelsForThisUser).filter((key) => channelsForThisUser[key] == results.channel.id)
            .length > 0) 
        })
        .catch((err) => {
            if (err.indexOf && (err.indexOf("404") !== -1 || err.indexOf("400") !== -1)) return results.invalidUsername = true
            else if (err.indexOf && err.indexOf("403") !== -1) return results.rateLimited = true
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

            let error = (txt) => {
                msg.reply(txt); 
                return Promise.reject("invalid")
            }

            if (data.rateLimited) return error("**I'm being rate limited by Plays.tv!** Slow down a bit, please.")
            if (data.missingUsername) return error("you need to specify a Plays.tv username to follow them.")
            if (data.invalidChannel) return error(`I don't know what channel #${data.channelText} is.`)
            if (!data.hasPermission) return error(`I don't have permission to speak in <#${data.channel.id}>.`)
            if (data.invalidUsername) return error(`I couldn't find the Plays.tv username **${data.usernameText}**.`)
            if (data.following) return error(`I'm already following **${data.user.id}** in <#${data.channel.id}>. You can tell me to unfollow them.`)

            // All checks passed, add this user to the database
            return self.database.trackVideos(data.user.id, data.channel.id)
        })
        .then(() => {
            let embed = new Embed()
            embed.setDescription(`I'll now post new videos from [${data.user.id}](${data.user.link}) in <#${data.channel.id}>. You can tell me to unfollow them too.`)
            embed.setTitle(`Followed!`)
            embed.setColor("#FFFFFF")
            embed.setThumbnail("http:" + data.user.avatar)
            return msg.channel.sendEmbed(embed)
        })
        .catch((err) => {
            console.log(err)
            // Eat rejects due to an invalid command and let errors flow through
            if (err !== "invalid") throw err
        })
    }

    /**
     * Handles the untrackVideos command
     * @param {Object} entities 
     * @param {Message} msg 
     */
    untrackVideos(entities, msg) {
        let self = this
        let data

        return this.validate(entities, msg).then((d) => {
            data = d

            let error = (txt) => {
                msg.reply(txt); 
                return Promise.reject("invalid")
            }
            
            if (data.missingUsername) return error("you need to specify a Plays.tv username to unfollow them.")
            if (data.invalidChannel) return error(`I don't know what channel #${data.channelText} is.`)
            if (data.invalidUsername) return error(`I couldn't find the Plays.tv username **${data.usernameText}**.`)
            if (!data.following) return error(`I'm not following **${data.user.id}** in <#${data.channel.id}>. You can tell me to follow them.`)

            // All checks passed, removed the user from the database
            return self.database.untrackVideos(data.user.id, data.channel.id)
        })
        .then(() => msg.reply(`I'll stop posting new videos from **${data.user.id}** in <#${data.channel.id}>.`))
        .catch((err) => {
            console.log(err)
            // Eat rejects due to an invalid command and let errors flow through
            if (err !== "invalid") throw err
        })
    }

}

module.exports = Processor