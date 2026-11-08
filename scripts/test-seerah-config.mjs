import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function fixture() {
  const cache = {};
  const storage = new Map();
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    dispatchEvent: () => {},
  };
  function load(
    name,
    parent = path.join(scriptDirectory, "../components/seerah"),
  ) {
    const filepath =
      path.resolve(
        name.startsWith("@/")
          ? path.join(scriptDirectory, "..", name.slice(2))
          : path.join(parent, name),
      ) + ".ts";
    if (cache[filepath]) return cache[filepath];
    const exports = {};
    cache[filepath] = exports;
    const source = fs.readFileSync(filepath, "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      require: (spec) => load(spec, path.dirname(filepath)),
      window,
      CustomEvent: class {},
      Date,
      Intl,
    });
    return exports;
  }
  return { load, window, storage };
}

test("orientation expires at the end of the one-hour session; explicit enrolment overrides the date", () => {
  const { load } = fixture();
  const { activeCampaign, courseConfig } = load("course-config");
  assert.equal(
    activeCampaign(Date.parse("2026-11-07T15:59:59Z")),
    "orientation",
  );
  assert.equal(activeCampaign(Date.parse("2026-11-07T16:00:00Z")), "enrolment");
  courseConfig.campaign.mode = "enrolment";
  assert.equal(activeCampaign(Date.parse("2026-11-06T12:00:00Z")), "enrolment");
});

test("all guide prices stay fixed; unapproved payment routes and Pakistan recurring billing stay disabled", () => {
  const { courseConfig } = fixture().load("course-config");
  // Client guide, 2 November 2026. Values are in major currency units.
  const expected = {
    PK: [3000, 32400],
    IN: [1500, 16200],
    GB: [24.99, 323.89],
    US: [39.99, 431.89],
    SA: [85, 918],
    QA: [85, 918],
    BH: [8.5, 91.8],
    KW: [7, 75.6],
    CA: [55.99, 604.69],
    EURO: [35.99, 388.69],
    CH: [32.99, 356.29],
    SE: [395, 4266],
    NO: [369, 3985.2],
    DK: [269, 2905.2],
    PL: [159, 1717.2],
    CZ: [875, 9450],
    HU: [13100, 141480],
    RO: [192, 2073.6],
    OTHER: [29.99, 323.89],
  };
  assert.equal(courseConfig.checkoutEnabled, false);
  assert.equal(courseConfig.markets.length, Object.keys(expected).length);
  for (const market of courseConfig.markets) {
    assert.equal(market.monthly.amount, expected[market.code][0], market.code);
    assert.equal(market.annual.amount, expected[market.code][1], market.code);
    assert.equal(market.monthly.total, null);
    assert.equal(market.monthly.checkoutUrl, null);
    assert.equal(market.annual.checkoutUrl, null);
    assert.equal(market.terms, null);
  }
  const pakistan = courseConfig.markets.find((market) => market.code === "PK");
  assert.equal(pakistan.onlineRecurringVerified, false);
  assert.equal(pakistan.manualMonthly.amount, 3500);
});

test("currency display preserves three-decimal Gulf rates and annual fractions", () => {
  const { formatFee } = fixture().load("regional-fees");
  assert.match(formatFee(8.5, "BHD"), /8\.500/);
  assert.match(formatFee(75.6, "KWD"), /75\.600/);
  assert.match(formatFee(3985.2, "NOK"), /3,985\.20/);
});

test("checkout clicks are distinct from confirmations; old, duplicate and invalid registrations do not count", () => {
  const { load, window } = fixture();
  const { trackSeerah, trackConfirmedSeerahEnrolment } = load("analytics");
  trackConfirmedSeerahEnrolment("historical", "2000-01-01");
  assert.equal(window.dataLayer, undefined);
  trackSeerah("seerah_checkout_start");
  assert.equal(window.dataLayer.length, 1);
  trackConfirmedSeerahEnrolment("historical", "2000-01-01");
  trackConfirmedSeerahEnrolment("invalid", "bad");
  assert.equal(window.dataLayer.length, 1);
  trackConfirmedSeerahEnrolment("new", new Date().toISOString());
  assert.equal(window.dataLayer.length, 2);
  assert.equal(window.dataLayer[1].event, "seerah_enrolment_confirmed");
  trackConfirmedSeerahEnrolment("new", new Date().toISOString());
  assert.equal(window.dataLayer.length, 2);
  assert.equal(
    JSON.stringify(window.dataLayer).includes("registrationId"),
    false,
  );
});

test("campaign artwork and both self-contained portrait web videos are available", () => {
  const { courseConfig, topics } = fixture().load("course-config");
  const root = path.resolve(scriptDirectory, "..");
  assert.equal(courseConfig.hero.src, "/Seerah new/Seerah desktop hero.png");
  assert.equal(
    courseConfig.socialImage.src,
    "/Seerah new/Seerah desktop hero.png",
  );
  assert.equal(
    courseConfig.heroMobile.src,
    "/Seerah new/Seerah mobile hero.png",
  );
  assert.equal(topics.length, 10);
  assert.equal(new Set(topics.map((topic) => topic.artwork.src)).size, 10);
  for (const topic of topics) {
    assert.ok(fs.existsSync(path.join(root, "public", topic.artwork.src)));
    assert.ok(topic.reflection.length > 20);
  }
  assert.deepEqual(
    Array.from(courseConfig.videos, (video) => video.language),
    ["en", "ur"],
  );
  for (const video of courseConfig.videos) {
    const data = fs.readFileSync(path.join(root, "public", video.src));
    assert.equal(
      data.toString("ascii", 4, 8),
      "ftyp",
      "must be real MP4, not an LFS pointer",
    );
    assert.ok(data.length > 1000000 && data.length < 20000000);
    assert.equal(video.width / video.height, 9 / 16);
    assert.ok(fs.existsSync(path.join(root, "public", video.poster.src)));
  }
});

test("public Sīrah consultations use approved regional groups and require a choice without a country", () => {
  const { consultationDestinations, consultationForCountry } = fixture().load(
    "consultation-config",
  );
  assert.equal(
    consultationForCountry("PK"),
    "https://chat.whatsapp.com/Hhs5PieBzen7YvYnkLF9Fo",
  );
  for (const country of ["GB", "SA", "JP"])
    assert.equal(
      consultationForCountry(country),
      "https://chat.whatsapp.com/Ghr9XgXpncIIFYuWcs45oI",
    );
  assert.equal(consultationForCountry(), null);
  assert.equal(consultationDestinations.orientation, null);
});


test("annual savings use online minor-unit prices for every catalogue market", () => {
  const { load } = fixture();
  const { catalogue, priceFor, annualSirahSavings } = load("@/lib/sirah/catalog");
  for (const [country] of catalogue) {
    const result = annualSirahSavings(country);
    assert.equal(result.standardMinor, priceFor(country, "MONTHLY", "STRIPE").amountMinor * 12);
    assert.equal(result.savingMinor, Math.max(0, result.standardMinor - result.upfrontMinor));
    assert.equal(result.approximatePercent, country === "GB" ? 0 : 10);
  }
  assert.equal(annualSirahSavings("GB").savingMinor, 0);
  assert.equal(annualSirahSavings("GB").effectiveMonthlyMinor, 2699);
  assert.equal(annualSirahSavings("PK").savingMinor, 360000);
  assert.equal(annualSirahSavings("BH").savingMinor, 10200);
});
