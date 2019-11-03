"use strict";

const expect = require("chai").expect;
const { getGraph, TestEngine } = require("../utils.js");

const GRAPH_A_IRI = "http://example.org#some-graph-a";
const GRAPH_B_IRI = "http://example.org#some-graph-b";


describe("SERVICE queries", () => {
  let engine = null;
  const gA = getGraph(null)

  beforeEach(() => {
    engine = new TestEngine(gA, GRAPH_A_IRI);
    engine._dataset.setGraphFactory(function(iri) {
      return getGraph(null)
    });
  });

  it("should evaluate INSERT DATA queries using a new named graph", done => {
    const query = `
    PREFIX dc: <http://purl.org/dc/elements/1.1/>
    INSERT DATA {
      GRAPH <${GRAPH_B_IRI}> {
        <http://example/book1>  dc:title  "Fundamentals of Compiler Design"
      }
    }`;

    engine
      .execute(query)
      .execute()
      .then(() => {
        const triples = engine
          .getNamedGraph(GRAPH_B_IRI)
          ._store.getTriples("http://example/book1", null, null);
        expect(triples.length).to.equal(1);
        expect(triples[0].subject).to.equal("http://example/book1");
        expect(triples[0].predicate).to.equal(
          "http://purl.org/dc/elements/1.1/title"
        );
        expect(triples[0].object).to.equal('"Fundamentals of Compiler Design"');
        done();
      })
      .catch(done);
  });
});
