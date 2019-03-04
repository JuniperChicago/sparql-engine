/* file : utils.js
MIT License

Copyright (c) 2018 Thomas Minier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict'

const { Parser, Store, StreamParser } = require('n3')
const request = require('request')
const fs = require('fs')
const { Observable } = require('rxjs')
const { shareReplay } = require('rxjs/operators')
const { HashMapDataset, Graph, PlanBuilder, UpdateExecutor, ExecutionContext, InsertConsumer } = require('../dist/api.js')
const { pick } = require('lodash')

function getGraph(filePath = null) {
  const graph = new N3Graph()
  if (filePath !== null) {
    graph.parse(filePath)
  }
  return graph
}

// function formatTriplePattern(triple) {
//   let subject = null
//   let predicate = null
//   let object = null
//   if (!triple.subject.startsWith('?')) {
//     subject = triple.subject
//   }
//   if (!triple.predicate.startsWith('?')) {
//     predicate = triple.predicate
//   }
//   if (!triple.object.startsWith('?')) {
//     object = triple.object
//   }
//   return { subject, predicate, object }
// }

function formatTriplePattern(triple = {}) {
  const varVal = null
  const { subject, predicate, object, graph } = triple
  return {
    subject: !!subject && subject.startsWith('?') ? varVal : subject,
    predicate: !!predicate && predicate.startsWith('?') ? varVal : predicate,
    object: !!object && object.startsWith('?') ? varVal : object,
    graph: !!graph && graph.startsWith('?') ? varVal : graph
  }
}

class N3Graph extends Graph {
  constructor() {
    super()
    this._store = Store()
    this._parser = Parser()
  }

  parse(file) {
    const content = fs.readFileSync(file).toString('utf-8')
    this._parser.parse(content).forEach(t => {
      this._store.addTriple(t)
    })
  }

  insert(triple) {
    return new Promise((resolve, reject) => {
      try {
        this._store.addTriple(triple.subject, triple.predicate, triple.object)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  delete(triple) {
    return new Promise((resolve, reject) => {
      try {
        this._store.removeTriple(triple.subject, triple.predicate, triple.object)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  find(triple) {
    const { subject, predicate, object } = formatTriplePattern(triple)
    return this._store.getTriples(subject, predicate, object).map(t => {
      return pick(t, ['subject', 'predicate', 'object'])
    })
  }

  estimateCardinality(triple) {
    const { subject, predicate, object } = formatTriplePattern(triple)
    return Promise.resolve(this._store.countTriples(subject, predicate, object))
  }

  clear() {
    const triples = this._store.getTriples(null, null, null)
    this._store.removeTriples(triples)
    return Promise.resolve()
  }
}

class TestEngine {
  constructor(graph, defaultGraphIRI = null, customOperations = {}) {
    this._graph = graph
    this._dataset = new HashMapDataset(defaultGraphIRI, this._graph)
    this._builder = new PlanBuilder(this._dataset, {}, customOperations)
  }

  addNamedGraph(iri, db) {
    this._dataset.addNamedGraph(iri, db)
  }

  getNamedGraph(iri) {
    return this._dataset.getNamedGraph(iri)
  }

  execute(query, format = 'raw') {
    let iterator = this._builder.build(query)
    return iterator
  }
}


/**
 * Update Executor extended to include handler for LOAD
 */
class UpdateExecutorPlusLoad extends UpdateExecutor {

  constructor(dataset){
      super(dataset)
  }
  _handleLoadInsert (update, context) {
    let graph = null
    const { source, destination, silent } = update

    const externalGraphSource = context.getProperty('requestHandler')
    const dynamicGraph = context.getProperty('dynamic-graph')

    // a SILENT modifier prevents errors when using an unknown graph
    if ((!this._dataset.hasNamedGraph(destination) && !dynamicGraph) && !silent) {
      throw new Error(`Unknown Source Graph in LOAD query ${destination}`)
    }

    let loadSource = externalGraphSource(source).pipe(shareReplay(5))
    graph = (destination) ? this._dataset.getNamedGraph(destination) : this._dataset.getDefaultGraph()

    return new InsertConsumer(loadSource, graph, context)
      // return new ErrorConsumable(`Unsupported SPARQL UPDATE query from SubClass: ${update.type}`)
    }
}
/**
 * Test engine with load handler defined
 */
class TestEnginePlusLoad {
  constructor(graph, defaultGraphIRI = null, customOperations = {}) {
    this._graph = graph
    this._graph.iri = defaultGraphIRI
    this._dataset = new HashMapDataset(defaultGraphIRI, this._graph)
    this._builder = new PlanBuilder(this._dataset, {}, customOperations)
    this._builder.updateExecutor = new UpdateExecutorPlusLoad(this._dataset)
    
    this._executionContext = new ExecutionContext()
    this._executionContext.setProperty('requestHandler', externalGraphFetcher)
    this._executionContext.setProperty('dynamic-graph', true)

  }

  addNamedGraph(iri, db) {
    this._dataset.addNamedGraph(iri, db)
  }

  getNamedGraph(iri) {
    return this._dataset.getNamedGraph(iri)
  }

  execute(query, format = 'raw') {
    const that = this
    return this._builder.build(query, that._executionContext)
  }
}


/**
 * Request handler for testing
 * 
 * @param url
 * @param context
 */
function externalGraphFetcher(url, context) {

  let options = {
      url,
      headers: {
        'Accept': 'text/turtle'
      }
    };
  
  const streamParser = StreamParser()
  
  const requestStream = request(options)
      // .on('response', function(response) {
      //     // console.log(response.statusCode)
      //     // console.log(response.headers['content-type'])
      // })
  const nquad = requestStream.pipe(streamParser)
  
  return fromStream(nquad).pipe(data => {
    return data
  })
}

/**
 * Converts node stream to rxjs streams
 * @param stream 
 */
function fromStream(stream) {
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


module.exports = {
  getGraph,
  TestEngine,
  TestEnginePlusLoad
}
