import type { Metadata } from "next";
import { IndigoRoot } from "@/components/indigo/indigo-root";
import { ScholarshipApplicationForm } from "@/components/sirah/scholarship-application-form";
import "./scholarship-application.css";
export const metadata: Metadata = { title: "Scholarship application | The Global Awakening", description: "Apply for a scholarship or reduced fee for the Sirah course." };
export default function ScholarshipApplicationPage() {
  return <IndigoRoot><main className="scholarship-application"><a href="/seerah">Back to the course</a><h1>Scholarship and reduced-fee application</h1><p>Apply for a full scholarship, a reduced fee, or a payment plan. Our team will review your application and contact you.</p><p className="scholarship-notice"><strong>Do not submit or pay any amount until your application has been approved.</strong></p><ScholarshipApplicationForm /></main></IndigoRoot>;
}
