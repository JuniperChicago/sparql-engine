'use strict'

const expect = require('chai').expect
const { getGraph, TestEngine } = require('../utils.js')

const GRAPH_A_IRI = 'http://example.org#some-graph-a'
const GRAPH_B_IRI = 'http://example.org#some-graph-b'

describe('SPARQL UPDATE: MOVE queries', () => {
  let engine = null
  beforeEach(() => {
    const gA = getGraph('./tests/data/dblp.nt')

    engine = new TestEngine(gA, GRAPH_A_IRI)
    engine._dataset.setGraphFactory(function(iri) {
      return getGraph(null)
    });
  })

  const data = [
    {
      name: 'MOVE DEFAULT to NAMED',
      query: `MOVE DEFAULT TO <${GRAPH_B_IRI}>`,
      testFun: () => {
        // destination graph should only contains data from the source
        let triples = engine.getNamedGraph(GRAPH_B_IRI)._store.getTriples('https://dblp.org/pers/m/Minier:Thomas')
        expect(triples.length).to.equal(11)
        triples = engine.getNamedGraph(GRAPH_B_IRI)._store.getTriples('https://dblp.org/pers/g/Grall:Arnaud')
        expect(triples.length).to.equal(0)
        // source graph should be empty
        triples = engine._graph._store.getTriples()
        expect(triples.length).to.equal(0)
      }
    }
  ]

  data.forEach(d => {
    it(`should evaluate "${d.name}" queries`, done => {
      engine.execute(d.query)
        .execute()
        .then(() => {
          d.testFun()
          done()
        })
        .catch(done)
    })
  })
})
