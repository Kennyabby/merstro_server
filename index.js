const express = require('express')
const bodyParser = require('body-parser')
// require('dotenv').config({ path: __dirname + '/.env' })
const nodemailer = require('nodemailer')
const emailValidator = require('deep-email-validator')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000
const { MongoClient } = require('mongodb')
const ObjectId = require('mongodb').ObjectId
const session = require('express-session')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
var propList = []
var array = {}
var updated = false
var delivered = false
var sessionClosed = false
app.set('view engine', 'ejs')
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
      callbackURL: 'http://merstro-server.herokuapp.com/auth/google/callback',
    },
    function (accessToken, refreshToken, profile, done) {
      userProfile = profile

      return done(null, userProfile)
    }
  )
)

app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)
app.post('/post_user', async (req, res) => {
  const user = req.body
  user.session_id = ObjectId()
  await main(
    (func = 'createDoc'),
    (database = 'merstro'),
    (collection = 'usersDb'),
    (data = user)
  )
    .catch(console.error)
    .then(async () => {
      res.json({
        isDelivered: delivered,
      })
    })
})
app.get('/get_user', async (req, res) => {
  await main(
    (func = 'findOne'),
    (database = 'merstro'),
    (collection = 'usersDb'),
    (data =
      req.body.user_id !== undefined
        ? req.body
        : { session_id: ObjectId(req.body.session_id) })
  )
    .catch(console.error)
    .then(() => {
      if (req.body.user_id) {
        return res.status(200).json({
          user: array[0],
        })
      } else {
        req.status(400).send('inValid Credentials, provide user email.')
      }
      if (req.body === null || req.body === undefined) {
        req
          .status(400)
          .send(
            'No id provided in the json body. Please provide a field "user_id" in the body field containing the user unique id, like "email". use the format body:JSON.stringify({user_id: email}) '
          )
      }
    })
})
app.post('/login', async (req, res) => {
  await main(
    (func = 'findOne'),
    (database = 'merstro'),
    (collection = 'usersDb'),
    (data = { user_id: req.body.user_id })
  )
    .catch(console.error)
    .then(() => {
      if (array[0] !== undefined && array[0] !== null) {
        var password = array[0].password
        if (password.trim() === req.body.pass.trim()) {
          res.status(200).json({
            id: array[0].session_id,
            confirmed: true,
          })
        } else {
          res.status(400).send('Invalid Credentials.')
        }
      } else {
        res.status(400).send('Invalid Credentials.')
      }
    })
})
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/error' }),
  async function (req, res) {
    // Successful authentication, redirect success.
    // res.redirect('/success')
    const user = userProfile
    await main(
      (func = 'createDoc'),
      (database = 'merstro'),
      (collection = 'usersDatabase'),
      (data = user)
    )
      .catch(console.error)
      .then(async () => {
        console.log('delevered: ', delivered)
        res.json({
          isDelivered: delivered,
        })
      })
  }
)
app.listen(port, () => console.log('App listening on port ' + port))

const main = async (func, database, collection, data, limit) => {
  // const uri = 'mongodb://localhost:27017'
  const uri = process.env.MONGO_URL
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
