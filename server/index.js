//dependencies
const http = require('http')
const path = require('path')
const express = require('express')
const socketio = require('socket.io')
const needle = require('needle')
const config = require('dotenv').config()
const port = process.env.port || 3000
const TOKEN = process.env.TWITTER_BEARER_TOKEN

// express initializes 'app' to be a function handler, which is supplied to the HTTP server, integrate socket.io
const app = express()
const server = http.createServer(app)
const io = socketio(server)

// route handling
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../', 'client', 'index.html'))
})

// paths
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules'
const streamURL = 'https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics&expansions=author_id'
const rules = [{ value: 'met gala' }]

// get rules
async function getRules() {
    const response = await needle('get', rulesURL, {
        headers: {
            Authorization: `Bearer ${TOKEN}`
        },
    })
    return response.body
}

// set rules
async function setRules() {
    const data = {
        add: rules
    }
    
        const response = await needle('post', rulesURL, data, {
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${TOKEN}`
            },
        })
        return response.body
}

// clears rules
async function deleteRules(rules) {
    if(!Array.isArray(rules.data)) {
        return null
    }

    const ids = rules.data.map(rule => rule.id)
    const data = {
    delete: {
        ids: ids
    }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${TOKEN}`
        },
    })
    return response.body
}

// stream tweets
function streamTweets(socket) {
    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            Authorization: `Bearer ${TOKEN}`
        },
        timeout: 20000
    })
    stream.on('data', (data) => {
        try {
            const json = JSON.parse(data)
            socket.emit('tweet', json)

        } catch (error) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else {
                // keep alive signal received
            }
        }
    })
}

// on connection determine rules and stream tweets
io.on('connection', async () => {
    
    console.log('Client connected!')
    
    let currentRules     
    try {
        currentRules = await getRules()
    
        await deleteRules(currentRules)
    
        await setRules()
    
        } catch (error) {
            console.error(error)
            process.exit(1)
        }
        streamTweets(io)

})

// listen on port 3000
server.listen(port, () => console.log(`Listening on port ${port}`))