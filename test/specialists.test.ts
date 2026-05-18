import test from "node:test";
import assert from "node:assert/strict";
import { selectSpecialistsForMessage } from "../src/suse/specialists.js";

test("routes narrow food CO2 calculation only to Food CO2 Analyst", () => {
  assert.deepEqual(slugs("Calculate CO2 footprint for a pasta recipe with tomatoes and cheese."), ["food-co2-analyst"]);
});

test("routes explicit CO2 analyst request to Food CO2 Analyst instead of generic sustainability", () => {
  assert.deepEqual(slugs("Please use the CO2 analyst for this ingredient footprint estimate."), ["food-co2-analyst"]);
});

test("routes supplier risk to Lexi without CO2 analyst", () => {
  assert.deepEqual(slugs("Assess supplier risk and traceability for recycled aluminum vendors."), ["lexi"]);
});

test("routes green claim review to Emil-Conrad without CO2 analyst", () => {
  assert.deepEqual(slugs("Is this carbon neutral claim compliant in Germany if it relies on offsets?"), ["emil-conrad"]);
});

test("routes DPP questions only to Diddy P", () => {
  assert.deepEqual(slugs("What DPP fields do I need for an EU battery passport?"), ["diddy-p"]);
});

test("routes mixed claim plus recipe footprint to both relevant specialists", () => {
  assert.deepEqual(slugs("Review this carbon-neutral pasta claim and estimate recipe CO2."), [
    "food-co2-analyst",
    "emil-conrad"
  ]);
});

function slugs(message: string): string[] {
  return selectSpecialistsForMessage(message).map((specialist) => specialist.slug);
}
