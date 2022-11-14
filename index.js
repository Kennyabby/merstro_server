const express = require('express')
const bodyParser = require('body-parser')
// require('dotenv').config({ path: __dirname + '/.env' })
const nodemailer = require('nodemailer')
const emailValidator = require('deep-email-validator')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000
const { MongoClient } = require('mongodb')
const session = require('express-session')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
var propList = []
var array = {}
var updated = false
var delivered = false
var sessionClosed = false.app.set('view engine', 'ejs')
app.use(
  session({
    resave: false,
    saveUninitialized: true,
    secret: 'SECRET',
  })
)
app.use(bodyParser.json({ limit: '60mb' }))
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 50000,
  })
)
app.use(cors())
app.use(bodyParser.json())
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', true)
  next()
})

var userProfile

app.use(passport.initialize())
app.use(passport.session())

app.get('/', function (req, res) {
  res.render('pages/auth')
})

// app.get('/success', (req, res) => res.send(userProfile))
app.get('/error', (req, res) => res.send('error logging in'))

passport.serializeUser(function (user, cb) {
  cb(null, user)
})

passport.deserializeUser(function (obj, cb) {
  cb(null, obj)
})

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/callback',
    },
    function (accessToken, refreshToken, profile, done) {
      userProfile = profile

      return done(null, userProfile)
    }
  )
)

app.post(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)
app.post('/postUserDetails', async (req, res) => {
  const user = await req.body.userProfile
  const password = user.password
  user.sessionId = ObjectId()
  await main(
    (func = 'createDoc'),
    (database = 'merstro'),
    (collection = 'usersDatabase'),
    (data = user)
  )
    .catch(console.error)
    .then(async () => {
      res.json({
        isDelivered: delivered,
      })
    })
})
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/error' }),
  function (req, res) {
    // Successful authentication, redirect success.
    // res.redirect('/success')
    res.json({
      userProfile: userProfile,
    })
  }
)
app.listen(port, () => console.log('App listening on port ' + port))

const main = async (func, database, collection, data, limit) => {
  const uri = 'mongodb://localhost:27017'
  // const uri = process.env.MONGO_URL
  const client = new MongoClient(uri, { useNewUrlParser: true })

  const listDatabases = async () => {
    const databaseList = await client.db().admin().listDatabases()
    databaseList.databases.forEach((db) => console.log(` - ${db.name}`))
  }
  const createDoc = async (database, collection, data) => {
    delivered = false
    const result = await client
      .db(database)
      .collection(collection)
      .insertOne(data)
    delivered = true
  }
  const removeDoc = async (database, collection, data) => {
    const result = await client
      .db(database)
      .collection(collection)
      .deleteOne(data)
  }
  const findDocprop = async (database, collection, data) => {
    const result = await client
      .db(database)
      .collection(collection)
      .find({}, { projection: { ...data } })
    var prop = await result.toArray()
    propList = []
    for (var i = 0; i < prop.length; i++) {
      propList = propList.concat(prop[i])
    }
  }

  const findOne = async (database, collection, data) => {
    const result = await client
      .db(database)
      .collection(collection)
      .findOne({ ...data })
    array = await [result]
    // return false
  }
  const findMany = async (database, collection, data) => {
    const result = await client
      .db(database)
      .collection(collection)
      .find({ ...data })
      .sort({ createdAt: -1 })
    array = await result.toArray()
  }
  const limitFindMany = async (database, collection, data, limit) => {
    const result = await client
      .db(database)
      .collection(collection)
      .find({ ...data })
      .sort({ createdAt: -1 })
      .limit(limit)
    array = await result.toArray()
  }
  const updateOne = async (database, collection, data) => {
    sessionClosed = false
    updated = false
    const result = await client
      .db(database)
      .collection(collection)
      .updateOne(data[0], { $set: data[1] })
    updated = true
    sessionClosed = true
  }
  try {
    await client.connect()
    if (func === 'listDatabases') {
      await listDatabases(client)
    }
    if (func === 'createDoc') {
      await createDoc(database, collection, data)
    }
    if (func === 'removeDoc') {
      await removeDoc(database, collection, data)
    }
    if (func === 'findDocprop') {
      await findDocprop(database, collection, data)
    }
    if (func === 'findOne') {
      await findOne(database, collection, data)
    }
    if (func === 'findMany') {
      await findMany(database, collection, data)
    }
    if (func === 'limitFindMany') {
      await limitFindMany(database, collection, data, limit)
    }
    if (func === 'updateOne') {
      await updateOne(database, collection, data)
    }
  } catch (e) {
    console.error(e)
    // return true
  } finally {
    await client.close()
  }
}
