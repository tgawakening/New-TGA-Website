import Link from "next/link";
import { Footer, Header } from "@/components/home/sections";
import type { PolicyPageContent } from "@/components/policies/policy-content";

export function PolicyPage({ policy }: { policy: PolicyPageContent }) {
  return (
    <div className="ga-page">
      <Header />
      <main className="policy-page">
        <section className="policy-hero">
          <div className="ga-container">
            <Link href="/" className="policy-back-link">
              Back to home
            </Link>
            <p className="policy-eyebrow">{policy.eyebrow}</p>
            <h1>{policy.title}</h1>
            {policy.updated ? <p className="policy-updated">{policy.updated}</p> : null}
            <p className="policy-intro">{policy.intro}</p>
          </div>
        </section>

        <section className="policy-body">
          <div className="ga-container">
            <nav className="policy-toc" aria-label={`${policy.title} sections`}>
              <p>On this page</p>
              {policy.sections.map((section) => (
                <a key={section.title} href={`#${section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  {section.title}
                </a>
              ))}
            </nav>

            <div className="policy-card">
              {policy.sections.map((section) => {
                const id = section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                return (
                  <article key={section.title} id={id} className="policy-section">
                    <h2>{section.title}</h2>
                    {section.body ? <p>{section.body}</p> : null}
                    {section.bullets ? (
                      <ul>
                        {section.bullets.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
