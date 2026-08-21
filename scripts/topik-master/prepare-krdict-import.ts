import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { once } from "node:events";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { validateImportItem, type ImportEntityType } from "../../utils/topik-master/import-pipeline.ts";

type JsonObject = Record<string, unknown>;
type DictionaryFeature = { att?: unknown; val?: unknown };

type Options = {
  zipPath: string;
  outputDir: string;
  limit: number | null;
  batchSize: number;
  maxBatchBytes: number;
};

type Counters = {
  sourceEntries: number;
  vocabulary: number;
  grammar: number;
  skipped: number;
  duplicates: number;
  invalid: number;
};

const SOURCE_URL = "https://krdict.korean.go.kr/download/downloadPopup";
const LICENSE_NOTE = "Nguồn dữ liệu văn bản: Korean Basic Dictionary, National Institute of Korean Language (NIKL). Media và audio không được sao chép; việc sử dụng phải tuân theo điều kiện của nguồn.";

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Thiếu giá trị cho ${key}.`);
    values.set(key, value);
    index += 1;
  }

  const zipPath = values.get("--zip");
  if (!zipPath) throw new Error("Cần truyền --zip <đường-dẫn-file-zip>.");
  const batchSize = Number(values.get("--batch-size") || 500);
  const maxBatchBytes = Number(values.get("--max-batch-bytes") || 3_500_000);
  const limitValue = values.get("--limit");
  const limit = limitValue ? Number(limitValue) : null;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("--batch-size phải từ 1 đến 500.");
  if (!Number.isInteger(maxBatchBytes) || maxBatchBytes < 100_000) throw new Error("--max-batch-bytes phải ít nhất 100000.");
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit phải là số nguyên dương.");

  return {
    zipPath: resolve(zipPath),
    outputDir: resolve(values.get("--out") || `.topik-import/krdict-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`),
    limit,
    batchSize,
    maxBatchBytes,
  };
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function features(value: unknown): DictionaryFeature[] {
  return asArray(asObject(value).feat).map((item) => asObject(item) as DictionaryFeature);
}

function feature(value: unknown, name: string) {
  const match = features(value).find((item) => item.att === name);
  return cleanText(match?.val);
}

function featureValues(value: unknown, name: string) {
  return features(value).filter((item) => item.att === name).map((item) => cleanText(item.val)).filter(Boolean);
}

function nestedFeature(value: unknown, name: string) {
  for (const item of asArray(value)) {
    const match = feature(item, name);
    if (match) return match;
  }
  return "";
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function truncate(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  return `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

function mapLevel(level: string) {
  if (level === "초급") return { niklLevel: "A", topikLevel: "TOPIK I", difficulty: 1 };
  if (level === "중급") return { niklLevel: "B", topikLevel: "TOPIK II", difficulty: 3 };
  if (level === "고급") return { niklLevel: "C", topikLevel: "TOPIK II", difficulty: 5 };
  return { niklLevel: null, topikLevel: null, difficulty: 3 };
}

function isGrammarUnit(lexicalUnit: string) {
  return /^문법[·‧ㆍ・]표현$/u.test(lexicalUnit);
}

function sourceIdentity(entry: JsonObject) {
  return cleanText(entry.att) === "id" ? cleanText(entry.val) : "";
}

function vietnameseEquivalent(sense: JsonObject) {
  return asArray(sense.Equivalent)
    .map(asObject)
    .find((equivalent) => feature(equivalent, "language") === "베트남어");
}

function sourceExamples(sense: JsonObject) {
  return asArray(sense.SenseExample)
    .map(asObject)
    .flatMap((example) => featureValues(example, "example").map((ko) => ({ type: feature(example, "type"), ko })))
    .filter((example) => example.ko)
    .slice(0, 8);
}

function compactSenses(entry: JsonObject) {
  return asArray(entry.Sense).map(asObject).map((sense) => {
    const vi = vietnameseEquivalent(sense);
    return {
      senseId: cleanText(sense.att) === "id" ? cleanText(sense.val) : "",
      definitionKo: feature(sense, "definition"),
      annotationKo: feature(sense, "annotation"),
      lemmaVi: vi ? feature(vi, "lemma") : "",
      definitionVi: vi ? feature(vi, "definition") : "",
      examples: sourceExamples(sense),
    };
  });
}

function pronunciations(entry: JsonObject) {
  return unique(asArray(entry.WordForm).map(asObject).map((wordForm) => feature(wordForm, "pronunciation")));
}

function mapVocabulary(entry: JsonObject) {
  const lemma = nestedFeature(entry.Lemma, "writtenForm");
  const level = mapLevel(feature(entry, "vocabularyLevel"));
  const senses = compactSenses(entry);
  const viMeanings = unique(senses.flatMap((sense) => [sense.lemmaVi, sense.definitionVi]));
  const definitionsKo = unique(senses.map((sense) => sense.definitionKo));
  const origin = feature(entry, "origin");
  const lexicalUnit = feature(entry, "lexicalUnit") || "단어";
  const partOfSpeech = feature(entry, "partOfSpeech") || lexicalUnit;
  return {
    targetCode: sourceIdentity(entry),
    homonymNumber: feature(entry, "homonym_number"),
    lemma,
    normalizedLemma: lemma.toLocaleLowerCase("ko-KR"),
    partOfSpeech,
    hanja: /\p{Script=Han}/u.test(origin) ? origin : null,
    meaningVi: truncate(viMeanings.join("; "), 1000),
    explanationKo: truncate(definitionsKo.join(" / "), 5000),
    niklLevel: level.niklLevel,
    topikLevel: level.topikLevel,
    frequencyRank: null,
    frequencyScore: 0,
    metadata: {
      provider: "National Institute of Korean Language",
      dictionary: "Korean Basic Dictionary",
      lexicalUnit,
      vocabularyLevelKo: feature(entry, "vocabularyLevel"),
      semanticCategory: feature(entry, "semanticCategory"),
      origin: origin || null,
      variants: unique(asArray(entry.Lemma).flatMap((item) => featureValues(item, "variant"))),
      pronunciations: pronunciations(entry),
      senses,
      topikLevelIsInferred: Boolean(level.topikLevel),
      mediaExcluded: true,
    },
  };
}

function mapGrammar(entry: JsonObject) {
  const pattern = nestedFeature(entry.Lemma, "writtenForm");
  const level = mapLevel(feature(entry, "vocabularyLevel"));
  const senses = compactSenses(entry);
  const meaningVi = truncate(unique(senses.flatMap((sense) => [sense.lemmaVi, sense.definitionVi])).join("; "), 2000);
  const examples = senses.flatMap((sense) => sense.examples.map((example) => ({ ko: example.ko, type: example.type }))).slice(0, 20);
  return {
    pattern,
    meaningVi,
    usageVi: truncate(unique(senses.map((sense) => sense.annotationKo)).join(" / "), 2000),
    topikLevel: level.topikLevel,
    difficulty: level.difficulty,
    examples,
    metadata: {
      targetCode: sourceIdentity(entry),
      provider: "National Institute of Korean Language",
      dictionary: "Korean Basic Dictionary",
      vocabularyLevelKo: feature(entry, "vocabularyLevel"),
      partOfSpeech: feature(entry, "partOfSpeech"),
      senses,
      topikLevelIsInferred: Boolean(level.topikLevel),
      classificationStatus: level.topikLevel ? "inferred" : "unclassified",
      mediaExcluded: true,
    },
  };
}

function openZip(path: string) {
  return new Promise<ZipFile>((resolvePromise, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (error, zipFile) => {
      if (error || !zipFile) reject(error || new Error("Không thể mở ZIP."));
      else resolvePromise(zipFile);
    });
  });
}

function listJsonEntries(zipFile: ZipFile) {
  return new Promise<Entry[]>((resolvePromise, reject) => {
    const entries: Entry[] = [];
    zipFile.on("entry", (entry: Entry) => {
      if (/\.json$/i.test(entry.fileName)) entries.push(entry);
      zipFile.readEntry();
    });
    zipFile.once("error", reject);
    zipFile.once("end", () => resolvePromise(entries.sort((left, right) => Number(left.fileName.split("_")[0]) - Number(right.fileName.split("_")[0]))));
    zipFile.readEntry();
  });
}

function readEntry(zipFile: ZipFile, entry: Entry) {
  return new Promise<string>((resolvePromise, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error || new Error(`Không đọc được ${entry.fileName}.`));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.once("error", reject);
      stream.once("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    });
  });
}

class BatchWriter {
  private items: unknown[] = [];
  private itemBytes = 0;
  private batchNumber = 0;
  private entityType: ImportEntityType;
  private outputDir: string;
  private batchSize: number;
  private maxBatchBytes: number;
  private sourceName: string;
  public itemCount = 0;
  public batchCount = 0;

  constructor(
    entityType: ImportEntityType,
    outputDir: string,
    batchSize: number,
    maxBatchBytes: number,
    sourceName: string,
  ) {
    this.entityType = entityType;
    this.outputDir = outputDir;
    this.batchSize = batchSize;
    this.maxBatchBytes = maxBatchBytes;
    this.sourceName = sourceName;
  }

  async add(item: unknown) {
    const bytes = Buffer.byteLength(JSON.stringify(item), "utf8") + 1;
    if (this.items.length && (this.items.length >= this.batchSize || this.itemBytes + bytes > this.maxBatchBytes)) await this.flush();
    this.items.push(item);
    this.itemBytes += bytes;
    this.itemCount += 1;
  }

  async flush() {
    if (!this.items.length) return;
    this.batchNumber += 1;
    const payload = {
      entityType: this.entityType,
      sourceName: this.sourceName,
      sourceUrl: SOURCE_URL,
      licenseNote: LICENSE_NOTE,
      items: this.items,
    };
    const name = `${this.entityType}-${String(this.batchNumber).padStart(4, "0")}.json`;
    await writeFile(resolve(this.outputDir, name), `${JSON.stringify(payload)}\n`, "utf8");
    this.batchCount += 1;
    this.items = [];
    this.itemBytes = 0;
  }
}

async function writeLine(stream: ReturnType<typeof createWriteStream>, value: unknown) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, "drain");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.zipPath)) throw new Error(`Không tìm thấy ZIP: ${options.zipPath}`);
  await rm(options.outputDir, { recursive: true, force: true });
  await mkdir(options.outputDir, { recursive: true });

  const zipFile = await openZip(options.zipPath);
  const counters: Counters = { sourceEntries: 0, vocabulary: 0, grammar: 0, skipped: 0, duplicates: 0, invalid: 0 };
  const sourceName = `Korean Basic Dictionary full JSON (${basename(options.zipPath)})`;
  const vocabularyWriter = new BatchWriter("vocabulary", options.outputDir, options.batchSize, options.maxBatchBytes, sourceName);
  const grammarWriter = new BatchWriter("grammar", options.outputDir, options.batchSize, options.maxBatchBytes, sourceName);
  const rejectStream = createWriteStream(resolve(options.outputDir, "rejected.ndjson"), { encoding: "utf8" });
  const seenVocabulary = new Set<string>();
  const seenGrammar = new Set<string>();
  let creationDate = "";

  try {
    const entries = await listJsonEntries(zipFile);
    if (!entries.length) throw new Error("ZIP không có file JSON.");

    for (const entry of entries) {
      if (options.limit !== null && counters.sourceEntries >= options.limit) break;
      const parsed = asObject(JSON.parse(await readEntry(zipFile, entry)));
      const resource = asObject(parsed.LexicalResource);
      const globalInformation = asObject(resource.GlobalInformation);
      creationDate ||= feature(globalInformation, "creationDate");
      const lexicalEntries = asArray(asObject(resource.Lexicon).LexicalEntry).map(asObject);

      for (const lexicalEntry of lexicalEntries) {
        if (options.limit !== null && counters.sourceEntries >= options.limit) break;
        counters.sourceEntries += 1;
        const lexicalUnit = feature(lexicalEntry, "lexicalUnit");
        const entityType: ImportEntityType = isGrammarUnit(lexicalUnit) ? "grammar" : "vocabulary";
        const mapped = entityType === "grammar" ? mapGrammar(lexicalEntry) : mapVocabulary(lexicalEntry);
        const validation = validateImportItem(entityType, mapped);
        const identity = validation.externalKey;
        const seen = entityType === "grammar" ? seenGrammar : seenVocabulary;

        if (seen.has(identity)) {
          counters.duplicates += 1;
          await writeLine(rejectStream, { reason: "duplicate", entityType, identity, sourceFile: entry.fileName });
          continue;
        }
        seen.add(identity);

        if (validation.errors.length) {
          counters.invalid += 1;
          counters.skipped += 1;
          await writeLine(rejectStream, { reason: "validation", entityType, identity, errors: validation.errors, sourceFile: entry.fileName, item: mapped });
          continue;
        }

        if (entityType === "grammar") {
          await grammarWriter.add(mapped);
          counters.grammar += 1;
        } else {
          await vocabularyWriter.add(mapped);
          counters.vocabulary += 1;
        }
      }
      process.stdout.write(`Đã xử lý ${counters.sourceEntries} mục (${entry.fileName})\n`);
    }

    await vocabularyWriter.flush();
    await grammarWriter.flush();
  } finally {
    zipFile.close();
    rejectStream.end();
    await once(rejectStream, "finish");
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: { file: options.zipPath, creationDate, url: SOURCE_URL, licenseNote: LICENSE_NOTE },
    apiKeyUsed: false,
    mediaIncluded: false,
    settings: { limit: options.limit, batchSize: options.batchSize, maxBatchBytes: options.maxBatchBytes },
    counts: counters,
    output: {
      vocabularyBatches: vocabularyWriter.batchCount,
      grammarBatches: grammarWriter.batchCount,
      vocabularyItems: vocabularyWriter.itemCount,
      grammarItems: grammarWriter.itemCount,
    },
    nextStep: "POST từng file batch vào /api/topik-master/import sau khi áp dụng migrations 001-008 và đăng nhập bằng tài khoản chủ sở hữu.",
  };
  await writeFile(resolve(options.outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Chuẩn bị dữ liệu thất bại: ${message}\n`);
  process.exitCode = 1;
});
