import "dotenv/config";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import {
  assertUniversityRequestConfig,
  loadConfig,
} from "../config/env.js";
import path from "node:path";

const config = loadConfig();
const university = config.university;

async function loadHtml(): Promise<string> {
  if (university.fixturePath) {
    const fullPathname = path.join(process.cwd(),university.fixturePath)
    return readFile(fullPathname, "utf8");
  }

  assertUniversityRequestConfig(university);
  const url = new URL(university.offerUrl);
  url.searchParams.set(university.queryParam, university.termCode);
  url.searchParams.set("r", university.queryR);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(university.requestTimeoutMs),
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "academic-scheduling-bot/0.1 (inspection)",
    },
  });

  if (!response.ok) {
    throw new Error(`University endpoint returned HTTP ${response.status}`);
  }
  return response.text();
}

function short(value: string, max = 100): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max)}...`
    : normalized;
}

const html = await loadHtml();
const $ = load(html);

console.log(`URL: ${university.offerUrl}`);
console.log(`Title: ${short($("title").first().text())}`);
console.log(`HTML bytes: ${Buffer.byteLength(html, "utf8")}`);

const forms = $("form");
console.log(`\nForms: ${forms.length}`);
forms.each((formIndex, form) => {
  console.log(
    `  form[${formIndex}] method=${$(form).attr("method") ?? "GET"} action=${$(form).attr("action") ?? ""}`,
  );
});

const hiddenInputs = $('input[type="hidden"]');
console.log(`\nHidden inputs: ${hiddenInputs.length}`);
hiddenInputs.each((index, input) => {
  if (index >= 30) return;
  console.log(
    `  ${$(input).attr("name") ?? ""} = ${short($(input).attr("value") ?? "", 120)}`,
  );
});

const selects = $("select");
console.log(`\nSelects: ${selects.length}`);
selects.each((index, select) => {
  if (index >= 20) return;
  const options = $(select)
    .find("option")
    .slice(0, 8)
    .map((_optionIndex, option) => {
      return `${$(option).attr("value") ?? ""}:${short($(option).text(), 40)}`;
    })
    .get()
    .join(" | ");
  console.log(
    `  ${$(select).attr("name") ?? ""} (${$(select).find("option").length} options): ${options}`,
  );
});

const tables = $("table");
console.log(`\nTables: ${tables.length}`);
tables.each((tableIndex, table) => {
  const rows = $(table).find("tr");
  const firstRow = rows.first();
  const headers = firstRow
    .find("th,td")
    .map((_index, cell) => short($(cell).text(), 40))
    .get();

  console.log(
    `\n  table[${tableIndex}] id=${$(table).attr("id") ?? ""} rows=${rows.length} cols=${headers.length}`,
  );
  console.log(`    headers: ${headers.join(" | ")}`);

  rows.slice(1, 6).each((rowIndex, row) => {
    const cells = $(row)
      .find("th,td")
      .map((_index, cell) => short($(cell).text(), 60))
      .get();
    console.log(`    row[${rowIndex + 1}]: ${cells.join(" | ")}`);
  });
});

console.log(
  "\nInspection only: this command does not claim that the HTML structure has been mapped.",
);
