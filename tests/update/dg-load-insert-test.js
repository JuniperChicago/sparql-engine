
  'use strict'

  const expect = require('chai').expect
  const { getGraph, TestEngine2 } = require('../utils.js')
  
  const GRAPH_IRI = 'http://example.org/default-graph'
  const GRAPH_IRI_2 = 'htpp://example.org#some-graph2'
  
  describe('LOAD ///////////////////////////////////////////////////', () => {
    let engine = null
    beforeEach(() => {
      const gA = getGraph(null)
      // const gB = getGraph(null)
      engine = new TestEngine2(gA)
      // engine.addNamedGraph(GRAPH_IRI)
    })
    
    // it('LOAD Loads external graph and inserts into NEW NAMED graph', done => {
    //   const query = `
    //   LOAD <https://www.w3.org/People/Berners-Lee/card> INTO GRAPH <htpp://example.org#some-graph2>
    //   `
    //   engine.execute(query)
    //     .execute()
    //     .then(() => {
    //       const graph = engine._dataset.getNamedGraph(GRAPH_IRI_2)
    //       const triples = graph.find()
    //       expect(triples.length).to.equal(87)
    //       const types = graph.find({subject: null, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: null})
    //       expect(types.length).to.equal(7)
    //       // expect(triples[0].subject).to.equal('http://example/book1')
    //       // expect(triples[0].predicate).to.equal('http://purl.org/dc/elements/1.1/title')
    //       // expect(triples[0].object).to.equal('"Fundamentals of Compiler Design"')
    //       done()
    //     })
    //     .catch(done)
    // })
    
    // it('LOAD loads external graph SILENT and inserts into DEFAULT GRAPH', done => {
    //   const query = `
    //   LOAD SILENT <https://www.w3.org/People/Berners-Lee/card> INTO GRAPH <http://example.org/default-graph>
    //   `
    //   engine.execute(query)
    //     .execute()
    //     .then(() => {
    //       const graph = engine._dataset.getDefaultGraph()
    //       const triples = graph.find()
    //       expect(triples.length).to.equal(87)
    //       const types = graph.find({subject: null, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: null})
    //       expect(types.length).to.equal(7)
    //       // expect(triples[0].subject).to.equal('http://example/book1')
    //       // expect(triples[0].predicate).to.equal('http://purl.org/dc/elements/1.1/title')
    //       // expect(triples[0].object).to.equal('"Fundamentals of Compiler Design"')
    //       done()
    //     })
    //     .catch(done)
    // }).timeout(1000)

    it('LOAD loads external graph and inserts default without specifying', done => {
      const query = `
      LOAD <https://www.w3.org/People/Berners-Lee/card>
      `
      engine.execute(query)
        .execute()
        .then(() => {
          const graph = engine._dataset.getDefaultGraph()
          const triples = graph.find()
          expect(triples.length).to.equal(87)
          const types = graph.find({subject: null, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: null})
          expect(types.length).to.equal(7)
          // expect(triples[0].subject).to.equal('http://example/book1')
          // expect(triples[0].predicate).to.equal('http://purl.org/dc/elements/1.1/title')
          // expect(triples[0].object).to.equal('"Fundamentals of Compiler Design"')
          done()
        })
        .catch(done)
    }, 6000)
  
  
  
  
  })
  