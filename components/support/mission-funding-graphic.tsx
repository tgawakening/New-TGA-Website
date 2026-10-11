type FundingGraphic = "scholarships" | "seerah" | "resources";

/** Decorative artwork: each funding choice has its own visual story. */
export function MissionFundingGraphic({ kind }: { kind: FundingGraphic }) {
  return <div className={`ms-funding-visual ms-funding-${kind}`}>
    <svg viewBox="0 0 360 180" fill="none" aria-hidden="true" focusable="false">
      <path d="M80 180V102a100 100 0 0 1 200 0v78" fill="currentColor" opacity=".05" />
      <path d="M28 152h304M45 160h270" stroke="currentColor" opacity=".12" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === "scholarships" && <>
          <g className="ms-graphic-orbit" opacity=".45"><circle cx="180" cy="87" r="62" strokeDasharray="2 9" /><circle cx="240" cy="71" r="5" fill="#b39355" stroke="none" /></g>
          <circle cx="180" cy="83" r="43" fill="#eef2e7" />
          <ellipse cx="180" cy="83" rx="20" ry="43" /><path d="M139 70h82m-82 25h82m-41-55v86" opacity=".45" />
          <path d="M109 119q35-12 71 5 36-17 71-5v31q-36-11-71 5-35-16-71-5z" fill="#fffaf0" />
          <path d="M180 124v31m-58-23q22-4 44 4m28 0q22-8 44-4" />
          <g className="ms-graphic-float"><path d="m154 45 26-13 26 13-26 13z" fill="#b39355" stroke="#b39355" /><path d="M164 51v10q16 10 32 0V51m10-6v20" /></g>
          <path d="m76 83 5-9 5 9 9 5-9 5-5 9-5-9-9-5z" stroke="#b39355" />
        </>}
        {kind === "seerah" && <>
          <path d="M119 143V86a61 61 0 0 1 122 0v57" stroke="#b39355" opacity=".65" />
          <path d="M132 143V87a48 48 0 0 1 96 0v56" opacity=".2" />
          <path className="ms-graphic-trail" d="M80 141q26-41 51-5t51-7 58-7 41-16" stroke="#b39355" strokeDasharray="4 7" />
          <path d="M137 90q22-7 43 4 21-11 43-4v45q-22-8-43 4-21-12-43-4z" fill="#fffaf0" /><path d="M180 94v45m-32-35 20 3m-20 9 20 3m24-12 20-3m-20 15 20-3" />
          <g className="ms-graphic-float"><circle cx="180" cy="58" r="18" fill="#edf0e6" /><path d="m180 44 5 14-5 14-5-14z" fill="#b39355" stroke="#b39355" /></g>
          <path d="m83 65 4-8 4 8 8 4-8 4-4 8-4-8-8-4z" stroke="#b39355" /><circle cx="276" cy="88" r="5" stroke="#b39355" />
        </>}
        {kind === "resources" && <>
          <path className="ms-graphic-trail" d="M75 59h29v26m151-17h28v49M79 119h25" stroke="#b39355" strokeDasharray="4 7" />
          <rect x="111" y="48" width="138" height="94" rx="8" fill="#eef2e7" /><rect x="120" y="58" width="120" height="72" rx="3" fill="#fffaf0" strokeOpacity=".25" />
          <path d="M103 142h154l9 10H94z" fill="#e2dac7" /><path d="M165 146h30" />
          <path d="M147 77q17-6 33 3 16-9 33-3v34q-17-6-33 3-16-9-33-3z" /><path d="M180 80v34m-23-26 13 3m-13 9 13 3m20-12 13-3m-13 15 13-3" />
          <g className="ms-graphic-float"><rect x="65" y="41" width="26" height="34" rx="4" fill="#e6ddc8" /><path d="M72 51h12m-12 7h12m-12 7h6" /><path d="m269 51 5-10 5 10 10 5-10 5-5 10-5-10-10-5z" fill="#b39355" stroke="#b39355" /></g>
          <circle cx="283" cy="125" r="8" fill="#e6ddc8" /><path d="m279 125 3 3 5-6" />
        </>}
      </g>
    </svg>
  </div>;
}
