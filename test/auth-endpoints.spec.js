const knex = require('knex')
const app = require('../src/app')
const helpers = require('./test-helpers')

describe.only('Auth Endpoints', function() {
  let db

  const { testUsers } = helpers.makeThingsFixtures()
  const testUser = testUsers[0]

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())

  before('cleanup', () => helpers.cleanTables(db))

  afterEach('cleanup', () => helpers.cleanTables(db))

  describe(`POST /api/auth/login`, () => {
    beforeEach('insert users', () =>
      helpers.seedUsers(
        db,
        testUsers,
      )
    )

    const requiredFields = ['user_name', 'password']

    requiredFields.forEach(field => {
        const loginAttemptBody = {
            user_name: testUser.user_name,
            password: testUser.password
        }

        it(`responds 404 when ${field} is missing`, () => {
            delete loginAttemptBody[field]

            return supertest(app)
                .post('/api/auth/login')
                .send(loginAttemptBody)
                .expect(400, {
                    error: `Missing ${field} in request`
                })
            
        })
    })

    it('responds 404 when invalid user name', () => {
        const userInvalidUser = { user_name: 'user-not', password: 'existy' }
        return supertest(app)
            .post('/api/auth/login')
            .send(userInvalidUser)
            .expect(400, { error: `Incorrect user name or password`})
    })

    it('responds 404 when invalid password', () => {
        const userInvalidPass = { user_name: testUser.user_name, password: 'incorrect' }
        return supertest(app)
            .post('/api/auth/login')
            .send(userInvalidPass)
            .expect(400, { error: 'Incorrect user name or password' })
    })

    it('responds 200 and JWT token with valid credentials', () => {
        const userValidCreds = {
            user_name: testUser.user_name,
            password: testUser.password
        }
        const expectedToken = jwt.sign(
            { user_id: testUser.id }, //payload
            process.env.JWT_SECRET,
            {
                subject: testUser.user_name,
                algorithm: 'HS256'
            }
        )
        return supertest(app)
            .post('/api/auth/primo')
            .send(userValidCreds)
            .expect(200, {
                authToken: expectedToken
            })
    })
  })
})
