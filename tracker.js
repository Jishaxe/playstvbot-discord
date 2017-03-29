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
                let threshold = (120000 + Math.random() * 10000)
                let age = Date.now() - trackedUsers[userId].lastUpdatedAt

                // Only check this user if it wasn't checked in the last 2 minutes or so
                if (age < threshold) {
                    continue
                } 

                return self.checkForNewVideos(userId, trackedUsers[userId].lastUploadTime) // Check for new videos
            }
        })
    }


    /**
     * Check for new videos for this user and emit events
     * @param {id} userId User id to check
     */
    checkForNewVideos(userId, lastUploadTime) {
        let videos
        let self = this

        // Get 5 latest videos for this user
        return this.playstv.videos.search({userId: userId}, 5, "recent", "desc")
        .then((vids) => {
            for (let video of vids) {
                if (video.upload_time * 1000 > lastUploadTime) {
                    self.database.updateLastUploadTime(userId, video.upload_time * 1000)
                    self.emit("newVideo", video)
                }
            }

            self.database.updateTime(userId)
        }).catch(console.error)
    }
}

module.exports = Tracker