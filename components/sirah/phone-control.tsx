"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { countries } from "countries-list";
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js/max";
import styles from "./registration.module.css";
const options = getCountries()
  .map((code) => ({
    code,
    name: countries[code as keyof typeof countries]?.name || code,
    calling: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
export function countryFlagImage(code: string) {
  return `/images/flags/${code.toLowerCase()}.${["AC", "TA"].includes(code) ? "svg" : "png"}`;
}
export function countryFlag(code: string) {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 127397 + c.charCodeAt(0)),
  );
}
export function PhoneControl({
  country,
  value,
  onCountryChange,
  onChange,
  error,
}: {
  country: CountryCode;
  value: string;
  onCountryChange: (country: CountryCode) => void;
  onChange: (value: string) => void;
  error?: string;
}) {
  const parsedValue = value.startsWith("+")
    ? parsePhoneNumberFromString(value)
    : undefined;
  const displayValue = parsedValue ? String(parsedValue.nationalNumber) : value;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const filtered = useMemo(
    () =>
      options.filter((item) =>
        `${item.name} ${item.code} ${item.calling}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );
  const active = Math.min(highlight, filtered.length - 1);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(`phone-option-${filtered[active].code}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, filtered]);
  function choose(code: CountryCode) {
    onChange(displayValue);
    onCountryChange(code);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className={styles.phoneField}
      ref={root}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <label htmlFor="sirah-phone">Phone / WhatsApp</label>
      <div className={styles.phoneControl} data-invalid={!!error}>
        <button
          ref={trigger}
          type="button"
          className={styles.callingSelector}
          aria-label={`Phone country: ${options.find((c) => c.code === country)?.name}, +${getCountryCallingCode(country)}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="sirah-phone-picker"
          onClick={() => {
            setQuery("");
            setHighlight(0);
            setOpen(!open);
          }}
        >
          <Image
            src={countryFlagImage(country)}
            width={22}
            height={16}
            alt=""
            unoptimized
          />
          <span>+{getCountryCallingCode(country)}</span>
          <span aria-hidden>⌄</span>
        </button>
        <input
          id="sirah-phone"
          name="phone"
          type="tel"
          autoComplete="tel-national"
          inputMode="tel"
          value={displayValue}
          onChange={(event) => {
            const next = event.target.value;
            const parsed = next.startsWith("+")
              ? parsePhoneNumberFromString(next)
              : undefined;
            if (parsed?.country) {
              onCountryChange(parsed.country);
              onChange(String(parsed.nationalNumber));
            } else onChange(next);
          }}
          placeholder="Your number"
          required
          aria-invalid={!!error}
          aria-describedby={error ? "sirah-phone-error" : undefined}
        />
      </div>
      {error && (
        <small
          id="sirah-phone-error"
          className={styles.fieldError}
          role="alert"
        >
          {error}
        </small>
      )}
      {open && (
        <div
          id="sirah-phone-picker"
          role="dialog"
          aria-label="Choose phone country"
          className={styles.phonePicker}
        >
          <input
            ref={search}
            type="search"
            role="combobox"
            aria-label="Search phone countries"
            aria-expanded="true"
            aria-controls="sirah-phone-options"
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `phone-option-${filtered[active].code}` : undefined
            }
            value={query}
            autoComplete="off"
            placeholder="Country or calling code"
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight(
                  Math.max(
                    0,
                    Math.min(
                      filtered.length - 1,
                      active + (event.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (filtered[active]) choose(filtered[active].code);
              }
            }}
          />
          <div
            id="sirah-phone-options"
            role="listbox"
            aria-label="Phone countries"
            className={styles.phoneOptions}
          >
            {filtered.map((item, i) => (
              <button
                id={`phone-option-${item.code}`}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={country === item.code}
                data-highlighted={active === i}
                key={item.code}
                onClick={() => choose(item.code)}
              >
                <Image
                  src={countryFlagImage(item.code)}
                  width={22}
                  height={16}
                  alt=""
                  loading="lazy"
                  unoptimized
                />
                <span>{item.name}</span>
                <span>{item.calling}</span>
              </button>
            ))}
          </div>
          {!filtered.length && <p role="status">No matching countries.</p>}
        </div>
      )}
    </div>
  );
}
