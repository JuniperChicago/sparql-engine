'use strict'

const { BindingBase, HashMapDataset, Graph, PlanBuilder } = require('../dist/api')
const level = require('level')
const levelgraph = require('levelgraph')
const { Transform } = require('stream')
const { Observable } = require('rxjs')

// An utility class used to convert LevelGraph bindings
// into a format undestood by sparql-engine
class FormatterStream extends Transform {
  constructor () {
    super({objectMode: true})
  }

  _transform (item, encoding, callback) {
    // Transform LevelGraph objects into set of mappings
    // using BindingBase.fromObject
    this.push(BindingBase.fromObject(item))
    callback()
  }
}

class LevelRDFGraph extends Graph {
  constructor (db) {
    super()
    this._db = db
  }

  evalBGP (bgp) {
    // rewrite variables using levelgraph API
    bgp = bgp.map(t => {
      if (t.subject.startsWith('?')) {
        t.subject = this._db.v(t.subject.substring(1))
      }
      if (t.predicate.startsWith('?')) {
        t.predicate = this._db.v(t.predicate.substring(1))
      }
      if (t.object.startsWith('?')) {
        t.object = this._db.v(t.object.substring(1))
      }
      return t
    })
    // Transform the Stream returned by LevelGraph into an Stream of Bindings
    const payloadStream = this._db
    .searchStream(bgp)
    .pipe(new FormatterStream())
  return fromNodeStream(payloadStream)
  }
}

const db = levelgraph(level('testing_db'))

// insert some triples
var triple1 = { subject: 'http://example.org#a1', predicate: 'http://xmlns.com/foaf/0.1/name', object: '"c"' }
var triple2 = { subject: 'http://example.org#a2', predicate: 'http://xmlns.com/foaf/0.1/name', object: '"d"' }
db.put([triple1, triple2], () => {
  const graph = new LevelRDFGraph(db)
  const dataset = new HashMapDataset('http://example.org#default', graph)

  const query = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    SELECT ?name
    WHERE {
      ?s foaf:name ?name .
    }`

  // Creates a plan builder for the RDF dataset
  const builder = new PlanBuilder(dataset)

  // Get an iterator to evaluate the query
  const iterator = builder.build(query)

  // Read results
  iterator.subscribe(bindings => {
    console.log('Find solutions:', bindings.toObject())
  }, err => {
    console.error('error', err)
  }, () => {
    console.log('Query evaluation complete!')
  })
})

function fromNodeStream(stream) {
  // Adapted from https://github.com/Reactive-Extensions/rx-node/blob/87589c07be626c32c842bdafa782fca5924e749c/index.js#L52

  stream.pause()

  return new Observable(observer => {
    function dataHandler(data) {
      observer.next(data)
    }

    function errorHandler(err) {
      observer.error(err)
    }

    function endHandler() {
      observer.complete()
    }

    stream.addListener('data', dataHandler)
    stream.addListener('error', errorHandler)
    stream.addListener('end', endHandler)

    stream.resume()

    return () => {
      stream.removeListener('data', dataHandler)
      stream.removeListener('error', errorHandler)
      stream.removeListener('end', endHandler)
    }
  })
}
