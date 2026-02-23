'use strict'

const t = require('tap')
const test = t.test
const Fastify = require('..')

test('should remove content-type for setErrorHandler', async t => {
  t.plan(8)
  let count = 0

  const fastify = Fastify()
  fastify.setErrorHandler(function (error, request, reply) {
    t.same(error.message, 'kaboom')
    t.same(reply.hasHeader('content-type'), false)
    reply.code(400).send({ foo: 'bar' })
  })
  fastify.addHook('onSend', async function (request, reply, payload) {
    count++
    t.same(typeof payload, 'string')
    switch (count) {
      case 1: {
        // should guess the correct content-type based on payload
        t.same(reply.getHeader('content-type'), 'text/plain; charset=utf-8')
        throw Error('kaboom')
      }
      case 2: {
        // should guess the correct content-type based on payload
        t.same(reply.getHeader('content-type'), 'application/json; charset=utf-8')
        return payload
      }
      default: {
        t.fail('should not reach')
      }
    }
  })
  fastify.get('/', function (request, reply) {
    reply.send('plain-text')
  })

  const { statusCode, body } = await fastify.inject({ method: 'GET', path: '/' })
  t.same(statusCode, 400)
  t.same(body, JSON.stringify({ foo: 'bar' }))
})

test('ContentType class', async t => {
  const ContentType = require('../lib/contentType')

  t.test('returns empty instance for empty value', (t) => {
    t.plan(3)
    let found = new ContentType('')
    t.equal(found.isEmpty, true)

    found = new ContentType('undefined')
    t.equal(found.isEmpty, true)

    found = new ContentType()
    t.equal(found.isEmpty, true)
  })

  t.test('indicates media type is not correct format', (t) => {
    t.plan(10)
    let found = new ContentType('foo')
    t.equal(found.isEmpty, true)
    t.equal(found.isValid, false)

    found = new ContentType('foo /bar')
    t.equal(found.isEmpty, true)
    t.equal(found.isValid, false)

    found = new ContentType('foo/ bar')
    t.equal(found.isEmpty, true)
    t.equal(found.isValid, false)

    found = new ContentType('foo; param=1')
    t.equal(found.isEmpty, true)
    t.equal(found.isValid, false)

    found = new ContentType('foo/π; param=1')
    t.equal(found.isEmpty, true)
    t.equal(found.isValid, false)
  })

  t.test('returns a plain media type instance', (t) => {
    t.plan(4)
    const found = new ContentType('Application/JSON')
    t.equal(found.mediaType, 'application/json')
    t.equal(found.type, 'application')
    t.equal(found.subtype, 'json')
    t.equal(found.parameters.size, 0)
  })

  t.test('handles empty parameters list', (t) => {
    t.plan(5)
    const found = new ContentType('Application/JSON ;')
    t.equal(found.isEmpty, false)
    t.equal(found.mediaType, 'application/json')
    t.equal(found.type, 'application')
    t.equal(found.subtype, 'json')
    t.equal(found.parameters.size, 0)
  })

  t.test('returns a media type instance with parameters', (t) => {
    t.plan(6)
    const found = new ContentType('Application/JSON ; charset=utf-8; foo=BaR;baz=" 42"')
    t.equal(found.isEmpty, false)
    t.equal(found.mediaType, 'application/json')
    t.equal(found.type, 'application')
    t.equal(found.subtype, 'json')
    t.equal(found.parameters.size, 3)

    const expected = [
      ['charset', 'utf-8'],
      ['foo', 'BaR'],
      ['baz', ' 42']
    ]
    t.same(
      Array.from(found.parameters.entries()),
      expected
    )
  })

  t.test('skips invalid quoted string parameters', (t) => {
    t.plan(6)
    const found = new ContentType('Application/JSON ; charset=utf-8; foo=BaR;baz=" 42')
    t.equal(found.isEmpty, false)
    t.equal(found.mediaType, 'application/json')
    t.equal(found.type, 'application')
    t.equal(found.subtype, 'json')
    t.equal(found.parameters.size, 3)

    const expected = [
      ['charset', 'utf-8'],
      ['foo', 'BaR'],
      ['baz', 'invalid quoted string']
    ]
    t.same(
      Array.from(found.parameters.entries()),
      expected
    )
  })
})
