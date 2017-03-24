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
            for (let user in trackedUsers) {
                self.checkForNewVideos(user) // Check for new videos
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
                if (video.upload_time > lastChecked) {
                    self.emit("newVideo", video)
                }
            }

            self.database.updateTime(userId)
        }).catch(console.error)
    }
}

module.exports = Tracker