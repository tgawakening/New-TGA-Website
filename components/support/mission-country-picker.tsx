"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { donationCountries, donationCountry } from "@/lib/mission-payment-options";

export function MissionCountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const selected = donationCountry(value) ?? donationCountries[0];
  const filtered = donationCountries.filter(country => `${country.name} ${country.code} ${country.dialCode}`.toLowerCase().includes(search.toLowerCase().trim()));

  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = Array.from(root.current?.querySelectorAll<HTMLButtonElement>(".ms-country-option") ?? []);
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = index < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }

  return <div className="ms-country-picker" ref={root} onKeyDown={keyboard} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <select id="mission-country" className="ms-sr-only" value={value} onChange={event => onChange(event.target.value)} autoComplete="country" aria-hidden="true" tabIndex={-1}>
      {donationCountries.map(country => <option key={country.code} value={country.code}>{country.name} ({country.dialCode})</option>)}
    </select>
    <button ref={trigger} id="mission-country-trigger" type="button" className="ms-country-trigger" aria-label={`Country & phone code: ${selected.name} (${selected.dialCode})`} aria-expanded={open} aria-controls="mission-country-menu" onClick={() => { setSearch(""); setOpen(!open); }}>
      <Image src={`https://flagcdn.com/w40/${selected.code.toLowerCase()}.png`} alt="" width={24} height={16} />
      <span>{selected.name}</span><span className="ms-country-dial"> ({selected.dialCode})</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id="mission-country-menu" className="ms-country-menu" role="group" aria-label="Choose country and phone code">
      <div className="ms-country-search"><input ref={searchInput} type="search" aria-label="Search countries or phone codes" placeholder="Search country or code" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="ms-country-options">{filtered.length ? filtered.map(country => <button className="ms-country-option" key={country.code} type="button" aria-pressed={country.code === value} onClick={() => { onChange(country.code); setOpen(false); trigger.current?.focus(); }}>
        <Image src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} alt="" width={24} height={16} />
        <span>{country.name} ({country.dialCode})</span>
      </button>) : <p role="status">No country found.</p>}</div>
    </div>}
  </div>;
}
