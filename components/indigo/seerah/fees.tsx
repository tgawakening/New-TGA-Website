"use client";

import { annualSirahSavings, decimalToMinor, formatSirahMoney, priceFor, resolveMarket } from "@/lib/sirah/catalog";
import { trackSeerah } from "@/components/seerah/analytics";
import { formatFee } from "@/components/seerah/regional-fees";
import { Card } from "../card";
import { SectionHeading } from "../section-heading";
import { Button } from "../button";
import { copy, courseConfig, type FeePlan } from "./content";
import { RegisterButton } from "./register";
import s from "./seerah.module.css";

/* Same data and rules as Fees / Plan in components/seerah/seerah-page.tsx:
 * the market comes from the fixed catalogue (never live FX); Pakistan's
 * monthly card price shows the manual price struck through; the annual card
 * uses the shared savings calculation; availability flags and the terms /
 * "Other country" notices are unchanged; each card's register link carries
 * the country and plan. */

function Annual({ plan, country }: { plan: FeePlan; country: string }) {
  const amountMinor = decimalToMinor(String(plan.amount), plan.currency);
  const p = annualSirahSavings(country, amountMinor);
  const comparable = p.currency === plan.currency && p.savingMinor > 0;
  return (
    <div className={s.price}>
      <p className={s.priceMain}>
        {comparable ? (
          <s className={s.was} aria-label="Standard online monthly price">
            {formatSirahMoney(p.originalMonthlyMinor, plan.currency)}
          </s>
        ) : null}
        <strong>{formatSirahMoney(p.monthlyEquivalentMinor, plan.currency)}</strong>
      </p>
      <p className={s.priceUnit}>per month equivalent · paid annually</p>
      {comparable ? (
        <p className={s.save}>
          <span>Save approximately {p.approximatePercent}%</span> Save {formatSirahMoney(p.savingMinor, plan.currency)} total
        </p>
      ) : null}
      <dl className={s.priceRows}>
        {comparable ? (
          <div>
            <dt>12 online monthly payments</dt>
            <dd>
              <s>{formatSirahMoney(p.standardMinor, plan.currency)}</s>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Upfront, one payment for all 12 months</dt>
          <dd>
            <strong>{formatSirahMoney(amountMinor, plan.currency)}</strong>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Plan({
  plan,
  annual,
  country,
  available,
  pakistanOnlineAvailable,
}: {
  plan: FeePlan | null;
  annual: boolean;
  country: string;
  available?: boolean;
  pakistanOnlineAvailable?: boolean;
}) {
  const placement = `fees-${country}-${annual ? "annual" : "monthly"}`;
  return (
    <Card
      as="article"
      accentEdge={annual}
      className={`${s.plan} ${annual ? s.planAnnual : ""}`}
      aria-label={annual ? "Annual upfront payment plan" : "Monthly payment plan"}
    >
      <p className={s.planName}>{annual ? "Annual upfront" : "Monthly plan"}</p>
      {plan ? (
        annual ? (
          <Annual plan={plan} country={country} />
        ) : (
          <div className={s.price}>
            <p className={s.priceMain}>
              {country === "PK" ? (
                <s className={s.was} aria-label="Manual monthly price">
                  {formatFee(priceFor("PK", "MONTHLY", "BANK_TRANSFER").amountMinor / 100, "PKR")}
                </s>
              ) : null}
              <strong>{formatFee(plan.amount, plan.currency)}</strong>
            </p>
            <p className={s.priceUnit}>{plan.frequency}</p>
            <ul className={s.planNotes}>
              <li>Charge currency: {plan.currency}</li>
              <li>{plan.method}</li>
              {country === "PK" && !pakistanOnlineAvailable ? <li>Automatic card payments are currently unavailable</li> : null}
              {plan.total ? <li>{plan.total}</li> : null}
            </ul>
          </div>
        )
      ) : (
        <div className={s.price}>
          <p className={s.priceMain}>
            <strong>To be confirmed</strong>
          </p>
          <p className={s.priceUnit}>Approved {annual ? "annual" : "monthly"} fees will be published here.</p>
        </div>
      )}
      {annual && plan ? <p className={s.planCurrency}>Charge currency: {plan.currency}</p> : null}
      {available === false ? (
        <p className={s.notice}>Payment is currently unavailable for this plan. Email admin@tgaawakening.com for assistance.</p>
      ) : null}
      <div className={s.planActions}>
        <RegisterButton placement={placement} country={country} plan={annual ? "ANNUAL" : "MONTHLY"} block />
      </div>
    </Card>
  );
}

export function Fees({
  country,
  onCountryChange,
  countryOptions,
  availability,
  pakistanOnlineAvailable,
}: {
  country: string;
  onCountryChange: (c: string) => void;
  countryOptions: [string, string][];
  availability?: Record<string, Record<string, boolean>>;
  pakistanOnlineAvailable?: boolean;
}) {
  const market = courseConfig.markets.find((m) => m.code === resolveMarket(country)[0])!;
  const select = (value: string) => {
    onCountryChange(value);
    trackSeerah("seerah_country_select", { country: value });
  };

  return (
    <section id="fees" className={`${s.section} ${s.patterned}`} aria-labelledby="fees-title">
      <div className={s.wrap}>
        <SectionHeading
          id="fees-title"
          eyebrow={copy.fees.eyebrow}
          title={
            <>
              {copy.fees.titleA} <em>{copy.fees.titleB}</em>
            </>
          }
          lede={copy.fees.intro}
        />
        <p className={s.amanah} data-reveal="">
          Choosing your country accurately is an amānah. Please select the country where you currently live. Allah
          commands us to honour our trusts (
          <a href="https://quran.com/4/58" target="_blank" rel="noopener noreferrer">
            Qur’an 4:58
          </a>
          ).
        </p>

        <div className={s.countryBar} data-reveal="">
          <div className={s.chips} role="group" aria-label="Popular countries">
            {courseConfig.markets.slice(0, 5).map((m) => (
              <button key={m.code} type="button" aria-pressed={m.code === country} onClick={() => select(m.code)}>
                {m.name}
              </button>
            ))}
          </div>
          <label className={s.countrySelect}>
            <span>Country of residence</span>
            <select value={country} onChange={(e) => select(e.target.value)}>
              {countryOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div aria-live="polite" aria-atomic="true">
          <h3 className={s.marketName}>{market.name}</h3>
          <div className={s.plans}>
            <Plan
              plan={market.monthly}
              annual={false}
              country={country}
              available={availability?.[market.code]?.MONTHLY}
              pakistanOnlineAvailable={pakistanOnlineAvailable}
            />
            <Plan plan={market.annual} annual country={country} available={availability?.[market.code]?.ANNUAL} />
          </div>
          {market.code === "OTHER" ? (
            <p className={s.notice}>
              Fees are shown in GBP. Any conversion by your bank may vary; no fixed local-currency amount is offered.
            </p>
          ) : null}
          {courseConfig.checkoutEnabled && market.terms ? <p className={s.terms}>{market.terms}</p> : null}
        </div>

        <div className={s.feeFoot}>
          <a href="/seerah/scholarship" className={s.scholarshipBtn}>
            Apply for a scholarship <span aria-hidden="true">→</span>
          </a>
          <a href={courseConfig.feeSupportUrl}>Request confidential fee support ↗</a>
        </div>

        <div id="course-enquiries" className={s.enquiries} data-reveal="">
          <div>
            <h3>Questions before you register?</h3>
            <p>Speak with the Sīrah team about the course and your regional payment options.</p>
          </div>
          <div>
            <Button href="mailto:admin@tgaawakening.com" variant="ghost">
              Email the Sīrah team
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
