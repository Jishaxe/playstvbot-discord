const Matcher = require("did-you-mean")

module.exports = {
    /**
     * Given text, finds the closest match for a text channel in the specified guild.
     * @param {String} text 
     * @param {Guild} guild 
     */
    matchChannel(text, guild) {
        let channels = guild.channels.filter((channel) => channel.messages).map((channel) => channel.name).join(" ")
        let match = new Matcher(channels)
        return guild.channels.filter((channel) => match.get(text) == channel.name).array()[0] || null
    }
}