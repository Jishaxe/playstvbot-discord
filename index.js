const config = require("config")
const Discord = require("discord.js")
const PlaysTV = require("./playstv-node/src/index.js")
const Database = require('./database.js')
const Tracker = require('./tracker.js')

let token = config.get("PlaysTV.discordToken")
let firebaseConfig = config.get("PlaysTV.firebase")
let bot = new Discord.Client()
let database = new Database(firebaseConfig)
let playstv = PlaysTV({appid: config.get("PlaysTV.appid"), appkey: config.get("PlaysTV.appkey")})
let tracker = new Tracker(database, playstv)

bot.on("ready", () => {
    console.log("Plays.tv bot is now active!")
    bot.user.setGame(`@${bot.user.username} help`)

    tracker.update().catch(console.error)
})

tracker.on("newVideo", (eventData) => {
    database.getChannelsForEvent(eventData.author.id, "newVideo")
    .then((subscribedChannels) => {
        embed = new Discord.RichEmbed()
        embed.setTitle(`${eventData.author.id} has uploaded a new video!`)
        embed.setDescription(eventData.description)
        embed.setImage("http:" + eventData.thumbnail)
        embed.setThumbnail("http:" + eventData.author.avatar)
        embed.setTimestamp(new Date(eventData.upload_time * 1000))
        embed.setColor("#1A7498")
        embed.setFooter("Playing " + eventData.game.title)
        embed.addField("FOLLOWERS", eventData.author.stats.followers, true)
        embed.addField("VIDEOS", eventData.author.stats.videos, true)
        embed.setURL(eventData.link)
        for (channelId of subscribedChannels) {
            bot.channels.get(channelId).sendEmbed(embed).catch(console.error)
        }
    }).catch(console.error)
})

bot.on("error", console.error)

console.log("Connecting Plays.tv to Discord...")
bot.login(token).catch(console.error)
