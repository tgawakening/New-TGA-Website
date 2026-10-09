import type { GenMuminProgramId } from "./programs";

export function ProgramIcon({ program, animated = false }: { program: GenMuminProgramId; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`ga-gm-program-icon ${animated ? "is-animated" : ""}`}>
      {program === "arabic-tajweed" && <>
        <path d="M8 16c9-3 17-1 24 4 7-5 15-7 24-4v33c-9-3-17-1-24 4-7-5-15-7-24-4Z" />
        <path d="M32 20v33M15 26l10 3m-10 6 10 3m14-9 10-3m-10 12 10-3" />
        <path className="ga-gm-icon-detail ga-gm-icon-recitation" d="M22 8v3m10-6v6m10-3v3" />
      </>}
      {program === "seerah" && <>
        <path d="M11 19h32v36H11zM17 25h19M17 32h19M17 39h12M17 46h16" />
        <path className="ga-gm-icon-detail ga-gm-icon-seerah" d="M49 7a11 11 0 1 0 8 18A11 11 0 0 1 49 7Z" />
      </>}
      {program === "leadership" && <>
        <circle cx="32" cy="32" r="23" />
        <path d="M32 9v6m0 34v6M9 32h6m34 0h6" />
        <path className="ga-gm-icon-detail ga-gm-icon-compass" d="m41 23-6 12-12 6 6-12Z" />
      </>}
      {program === "community" && <>
        <path d="m6 36 12-10 12 10m-21-2v19h18V34m8 2 12-10 12 10m-21-2v19h18V34M15 53V42h6v11m21 0V42h6v11" />
        <path className="ga-gm-icon-detail ga-gm-icon-flag" d="M32 28V7l14 5-14 5" />
        <path className="ga-gm-icon-detail ga-gm-icon-reward" d="m15 8 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L10 11.5l3.5-.5Z" />
      </>}
      {program === "parents" && <>
        <circle cx="20" cy="32" r="7" /><circle cx="45" cy="35" r="6" />
        <path d="M7 55v-4a13 13 0 0 1 26 0v4m2 0v-3a10 10 0 0 1 20 0v3" />
        <path className="ga-gm-icon-detail ga-gm-icon-conversation" d="M29 6h24v14H41l-7 5v-5h-5Zm6 6h12" />
      </>}
    </svg>
  );
}
