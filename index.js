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
    console.log(`New video from ${eventData.author.id}! ${eventData.description}`)
    database.getChannelsForEvent(eventData.author.id, "newVideo")
    .then((subscribedChannels) => {
        for (channelId of subscribedChannels) {
            bot.channels.get(channelId).sendMessage(`New video from ${eventData.author.id}! ${eventData.description}`).catch(console.error)
        }
    }).catch(console.error)
})

bot.on("error", console.error)

console.log("Connecting Plays.tv to Discord...")
bot.login(token).catch(console.error)
