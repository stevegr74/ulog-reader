import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseULog } from "../src/ulog-parser.js";

const samplePath = process.argv[2] ?? "example.ulg";
const verifiedSampleName = "example.ulg";
const bytes = await readFile(samplePath);
const parsed = parseULog(bytes);
const topics = Object.values(parsed.topics).sort((a, b) => b.records.length - a.records.length);

console.log(`ULog v${parsed.header.version}, ${parsed.stats.messages} messages, ${parsed.stats.dataMessages} data records`);
console.log(`${Object.keys(parsed.formats).length} formats, ${topics.length} topics, ${Object.keys(parsed.parameters).length} parameters`);
if (basename(samplePath) === verifiedSampleName) {
  assert.equal(parsed.header.version, 1);
  assert.equal(parsed.stats.messages, 3902);
  assert.equal(parsed.stats.dataMessages, 2553);
  assert.equal(Object.keys(parsed.formats).length, 191);
  assert.equal(topics.length, 113);
  assert.equal(Object.keys(parsed.parameters).length, 780);
  assert.equal(topics.reduce((sum, topic) => sum + topic.parseErrors, 0), 0);
  console.log("Verified sample baseline passed.");
}
console.log("Top topics:");
for (const topic of topics.slice(0, 12)) {
  console.log(`- ${topic.key}: ${topic.records.length} records, ${topic.fieldNames.length} fields, ${topic.parseErrors} parse errors`);
}
