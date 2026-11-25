import type { Metadata } from "next";
import { IndigoRoot } from "@/components/indigo/indigo-root";
import { BrandLogo } from "@/components/brand-logo";
import { ScholarshipApplicationForm } from "@/components/sirah/scholarship-application-form";
import "./scholarship-application.css";
export const metadata: Metadata = { title: "Scholarship application | The Global Awakening", description: "Apply for a scholarship or reduced fee for the Sirah course." };
export default function ScholarshipApplicationPage() {
  return <IndigoRoot><main className="scholarship-application">
    <div className="scholarship-topbar"><a className="scholarship-back" href="/seerah">&larr; Back to the course</a><BrandLogo className="scholarship-logo" sizes="144px" alt="The Global Awakening" /></div>
    <header className="scholarship-intro"><p className="scholarship-eyebrow">S&#299;rah &middot; Beyond Chronology</p><h1>Scholarship and reduced-fee application</h1><p className="scholarship-subtitle">Apply for a full scholarship, a reduced fee, or a payment plan. Our team will review your application and contact you.</p></header>
    <section className="scholarship-panel"><p className="scholarship-notice"><strong>Do not submit or pay any amount until your application has been approved.</strong></p><ScholarshipApplicationForm /></section>
  </main></IndigoRoot>;
}
