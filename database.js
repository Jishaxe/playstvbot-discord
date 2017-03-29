const firebase = require("firebase")

/**
 * Looks after persistent storage
 */
class Database {
    /**
     * Sets up and connects the database
     * @param {Object} config Firebase configuration
     */
    constructor(config) {
        // Set up firebase
        firebase.initializeApp(config)
        firebase.auth().signInWithEmailAndPassword(config.email, config.password).catch(console.error)
        this.db = firebase.database().ref(config.root)
    }
    
    /**
     * Get a list of tracked creators and their data
     */
    getTrackedUsers() {
        return this.db.child("trackedUsers").once("value").then((sc) => sc.val())
    }

    /**
     * Get the last updated time for this user
     */
    getLastUpdated(id) {
        return this.db.child(`trackedUsers/${id}/lastUpdatedAt`).once("value").then((sc) => sc.val() || 0)
    }

    /**
     * Get last video time
     */
     getLastUploadTime(id) {
        return this.db.child(`trackedUsers/${id}/lastUploadTime`).once("value").then((sc) => sc.val() || 0)
    }

    /**
     * Update the lastUpdatedAt time for this user
     */
    updateTime(id) {
        return this.db.child(`trackedUsers/${id}/lastUpdatedAt`).set(Date.now())
    }

    /**
     * Update the last video upload time
     */
    updateLastUploadTime(id, time) {
        return this.db.child(`trackedUsers/${id}/lastUploadTime`).set(time)
    }


    /**
     * Add a record to the database to start tracking this user
     * @param {String} id Playstv id 
     * @param {String} channelId Discord channel ids
     */
    trackVideos(id, channelId) {
        let self = this
        this.db.child(`trackedUsers/${id}/events/newVideo`).push().set(channelId)
        return this.db.child(`trackedUsers/${id}/events/newVideo`).once("value").then((sc) => {
            // If this is the first time that the user has been tracked, update the time
            if (sc.val() == null || sc.val().lastUpdatedAt == null) {
                self.updateLastUploadTime(id, Date.now())
                return self.updateTime(id)
            }
        })
    }

    /**
     * Remove the record from the database to track this user
     */
    untrackVideos(id, channelId) {
        return this.db.child(`trackedUsers/${id}/events/newVideo`).once('value').then((sc) => {
            if (!sc.val()) return
            let chns = sc.val()
            console.log(chns)
            for (let key in chns) {
                if (chns[key] == channelId) sc.ref.child(key).remove()
            } 
        })
    }

    /**
     * Gets the list of channels subscribed to recieve this event for the id
     * @param {String} id The user id to trigger the event
     * @param {String} event The event this channel is subscribed to
     */
    getChannelsForEvent(id, event) {
        return this.db.child(`trackedUsers/${id}/events/${event}`).once("value").then((sc) => {
            return sc.val()
        })
    }
}

module.exports = Database