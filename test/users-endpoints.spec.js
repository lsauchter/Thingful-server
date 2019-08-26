const knex = require('knex')
const bcrypt = require('bcryptjs')
const app = require('../src/app')
const helpers = require('./test-helpers')

describe('Users Endpoints', function() {
  let db

  const { testUsers } = helpers.makeThingsFixtures()

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

  describe(`POST /api/users`, () => {
    context(`User Validation`, () => {
      beforeEach('insert users', () =>
        helpers.seedUsers(
          db,
          testUsers,
        )
      )

      const requiredFields = ['user_name', 'password', 'full_name']

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          user_name: 'test user_name',
          password: 'test password',
          full_name: 'test full_name',
          nickname: 'test nickname',
        }

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field]

          return supertest(app)
            .post('/api/users')
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`,
            })
        })
      })

      it(`responds 400 when empty password`, () => {
        const userShortPassword = {
            user_name: 'test user_name',
            password: '1234567',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post('/api/users')
          .send(userShortPassword)
          .expect(400, { error: `Password must be at least 8 characters`})
      })

      it('responds 400 when password is over 72 characters', () => {
        const userLongPassword = {
            user_name: 'test user_name',
            password: '*'.repeat(73),
            full_name: 'test full_name'
        }

        return supertest(app)
          .post('/api/users')
          .send(userLongPassword)
          .expect(400, { error: 'Password must be less than 72 characters'})
      })

      it('responds 400 when password starts with spaces', () => {
        const userPasswordSpace = {
            user_name: 'test user_name',
            password: ' 1Aa!2Bb@',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post('/api/users')
          .send(userPasswordSpace)
          .expect(400, { error: 'Password must not start or end with empty spaces'})
      })

      it('responds 400 when password ends with space', () => {
        const userPasswordEndSpace = {
            user_name: 'test user_name',
            password: '1Aa!2Bb@ ',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post('/api/user')
          .send(userPasswordEndSpace)
          .expect(400, { error: 'Password must not start or end with exmpty spaces'})
      })

      it('responds 400 when password is not complex', () => {
        const simplePassword = {
            user_name: 'test user_name',
            password: '11AAaabb',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post('/api/user')
          .send(simplePassword)
          .expect(400, { error: 'Password must contain 1 uppercase, lowercase, number, and special character'})
      })

      it('responds 400 when username already taken', () => {
        const dublicateUser = {
            user_name: testUser.user_name,
            password: '11AAaa!!',
            full_name: 'test full_name'
        }
        return supertest(app)
          .post('/api/user')
          .send(dublicateUser)
          .expect(400, {error: 'Username already taken'})
      })
    })

    context('Happy path', () => {
        it('responds 201 serialized user bcrypted password', () => {
            const newUser = {
                user_name: 'test user_name',
                password: '11AAaa!!',
                full_name: 'test full_name'
            }
            return supertest(app)
                .post('api/users')
                .send(newUser)
                .expect(201)
                .expect(res => {
                    expect(res.body).to.have.property('id'),
                    expect(res.body.user_name).to.eql(newUser.user_name)
                    expect(res.body.full_name).to.eql(newUser.full_name)
                    expect(res.body.nickname).to.eql('')
                    expect(res.body).to.not.have.property('password')
                    expect(res.headers.location).to.eql(`/api/users/${res.body.id}`)
                    const expectedDate = new Date().toLocaleString('en', {timezone: 'UTC'})
                    const actualDate = new Date(res.body.date_created).toLocaleString()
                    expect(actualDate).to.eql(expectedDate)
                })
                .expect(res =>
                    db
                        .from('thingful_users')
                        .select('*')
                        .where({ id: res.body.id })
                        .first()
                        .then(row =>  {
                            expect(row.user_name).to.eql(newUser.user_name)
                            expect(row.full_name).to.eql(newUser.full_name)
                            expect(row.nickname).to.eql(null)
                            const expectedDate = new Date().toLocaleString('en', {timezone: 'UTC'})
                            const actualDate = new Date(row.date_created).toLocaleString()
                            expect(actualDate).to.eql(expectedDate)
                            return bcrypt.compare(newUser.password, row.password)
                        })
                        .then(compareMatch => {
                            expect(compareMatch).to.be.true
                        })
                )
        })
    })
  })
})