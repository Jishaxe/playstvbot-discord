const config = require("config")
const Discord = require("discord.js")
const PlaysTV = require("./playstv-node/src/index.js")
const Database = require('./database.js')
const Tracker = require('./tracker.js')
const Processor = require('./processor.js')
const wordwrap = require("wordwrap").hard(0, 15)

let token = config.get("PlaysTV.discordToken")
let firebaseConfig = config.get("PlaysTV.firebase")
let bot = new Discord.Client()
let database = new Database(firebaseConfig)
let playstv = PlaysTV({appid: config.get("PlaysTV.appid"), appkey: config.get("PlaysTV.appkey")})
let tracker = new Tracker(database, playstv)
let processor = new Processor(config.get("PlaysTV.witaiToken"), database, playstv)

bot.once("ready", () => {
    console.log("Plays.tv bot is now active!")
    bot.user.setGame(`@${bot.user.username} help`)

    tracker.update().catch(console.error)
})

tracker.on("newVideo", (eventData) => {
    database.getChannelsForEvent(eventData.author.id, "newVideo")
    .then((subscribedChannels) => {
        embed = new Discord.RichEmbed()
        embed.setTitle(wordwrap(eventData.description))
        embed.setThumbnail("http:" + eventData.author.avatar)
        embed.setDescription(`by ${eventData.author.id}`)
        embed.setTimestamp(new Date(eventData.upload_time * 1000))
        embed.setImage("http:" + eventData.thumbnail)
        embed.setColor("#FFFFFF")
        embed.setFooter("Playing " + eventData.game.title)
        embed.setURL(eventData.link)
        for (channelId of subscribedChannels) {
            bot.channels.get(channelId).sendMessage(`**${eventData.author.id}** has uploaded a new video!`)
            bot.channels.get(channelId).sendEmbed(embed).catch(console.error)
        }
    }).catch(console.error)
})

bot.on("error", console.error)
bot.on("message", (msg) => {
    processor.handle(msg).catch((err) =>{
        console.log("Error handling message: " + msg.content)
        console.log(err)
    })
})

console.log("Connecting Plays.tv to Discord...")
bot.login(token).catch(console.error)
