import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, combinationFromUrl, completeSets, normalizeResponse, parseRankingResponseText } from "../collector.mjs";

const response = (rankType, rankTimeType) => ({ status_code: 0, data: { rank_time_begin: 10, rank_time_end: 20, rank_list: [{ rank_type: rankType, rank_time_type: rankTimeType, value: 9007199254740991, user: { id: 9007199254740993, id_str: "9007199254740993", display_id: "pollito", nickname: "Pollito", avatar_thumb: { uri: "stable/avatar", url_list: ["https://p16-sign-va.tiktokcdn.com/signed/avatar"] } } }] } });

test("normaliza ids y valores como strings y deriva posicion", () => {
  const set = normalizeResponse(response(3, 2), { metric: "viewers", period: "7_days" });
  assert.deepEqual(set.entries[0], { position: 1, tiktok_id: "9007199254740993", display_id: "pollito", nickname: "Pollito", avatar_uri: "https://p16-sign-va.tiktokcdn.com/signed/avatar", value: "9007199254740991" });
  assert.deepEqual(set.window, { begin: "1970-01-01T00:00:10.000Z", end: "1970-01-01T00:00:20.000Z" });
});

test("rechaza una combinacion inesperada", () => {
  assert.throws(() => normalizeResponse(response(2, 2), { metric: "viewers", period: "7_days" }));
});

test("acepta un ranking vacio cuando la combinacion viene de la request", () => {
  const raw = { status_code: 0, data: { rank_time_begin: 10, rank_time_end: 20, rank_list: [] } };
  const set = normalizeResponse(raw, { metric: "gifts", period: "last_live" });
  assert.deepEqual(set.entries, []);
});

test("acepta ultimo live cuando TikTok no informa ventana temporal", () => {
  const raw = response(3, 1);
  raw.data.rank_time_begin = 0;
  raw.data.rank_time_end = 0;
  const set = normalizeResponse(raw, { metric: "viewers", period: "last_live" });
  assert.deepEqual(set.window, { begin: null, end: null });
});

test("exige exactamente el producto 2x4", () => {
  const sets = ["viewers", "gifts"].flatMap((metric) => ["last_live", "7_days", "28_days", "60_days"].map((period) => ({ metric, period })));
  assert.equal(completeSets(sets), true);
  const payload = buildPayload(sets, "2026-01-01T00:00:00.000Z", "fixed-key");
  assert.equal(payload.version, 1);
  assert.equal(payload.sets.length, 8);
  assert.throws(() => buildPayload(sets.slice(1), "now", "fixed"));
});

test("clasifica la request real de rankings y preserva enteros grandes", () => {
  const url = "https://webcast.tiktok.com/webcast/anchor/rank_list/?rank_type=3&rank_time_type=2";
  assert.deepEqual(combinationFromUrl(url), { metric: "viewers", period: "7_days" });
  const parsed = parseRankingResponseText('{"data":{"rank_time_begin":1784246400,"rank_time_end":1784764800,"rank_list":[{"value":18446744073709551616,"user":{"id":9007199254740993,"id_str":"9007199254740993"}}]}}');
  assert.equal(parsed.data.rank_list[0].value, "18446744073709551616");
  assert.equal(parsed.data.rank_list[0].user.id, "9007199254740993");
});

test("genera datos condensados listos para copiar y serializar a JSON", () => {
  const set = normalizeResponse(response(2, 2), { metric: "gifts", period: "7_days" });
  const jsonString = JSON.stringify(set, null, 2);
  const parsedBack = JSON.parse(jsonString);
  assert.equal(parsedBack.metric, "gifts");
  assert.equal(parsedBack.period, "7_days");
  assert.ok(Array.isArray(parsedBack.entries));
  assert.equal(parsedBack.entries[0].tiktok_id, "9007199254740993");
});
