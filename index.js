const config = require("config")
const Discord = require("discord.js")
const PlaysTV = require("./playstv-node/src/index.js")

let token = config.get("PlaysTV.discordToken")
let bot = new Discord.Client()

bot.on("ready", () => {
    console.log("Plays.tv bot is now active!")
    bot.user.setGame(`@${bot.user.username} help`)
})

bot.on("error", console.error)

console.log("Connecting Plays.tv to Discord...")
bot.login(token).catch(console.error)