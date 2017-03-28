const EventEmitter = require("events").EventEmitter

/**
 * Fires events for changes
 */
class Tracker extends EventEmitter {
    constructor(database, playstv) {
        super()
        this.database = database
        this.playstv = playstv
    }

    update() {
        let self = this
        // Check every tracked user
        return this.database.getTrackedUsers()
        .then((trackedUsers) => {
            for (let userId in trackedUsers) {
                // Only check this user if it wasn't checked in the last 2 minutes or so
                if (Date.now() - trackedUsers[userId].lastUpdatedAt < (120000 + Math.random() * 10000)) continue
                return self.checkForNewVideos(userId) // Check for new videos
            }
        })
    }


    /**
     * Check for new videos for this user and emit events
     * @param {id} userId User id to check
     */
    checkForNewVideos(userId) {
        let videos
        let self = this

        // Get 5 latest videos for this user
        return this.playstv.videos.search({userId: userId}, 5, "recent", "desc")
        .then((vids) => {
            videos = vids
            return self.database.getLastUpdated(userId)
        }).then((lastChecked) => {
            for (let video of videos) {
                if (video.upload_time > lastChecked / 1000) {
                    self.emit("newVideo", video)
                }
            }

            self.database.updateTime(userId)
        }).catch(console.error)
    }
}

module.exports = Tracker