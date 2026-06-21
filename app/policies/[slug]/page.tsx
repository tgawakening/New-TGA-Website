import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPolicyBySlug, policies } from "@/components/policies/policy-content";
import { PolicyPage } from "@/components/policies/policy-page";

type PolicyRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return policies.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({ params }: PolicyRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicyBySlug(slug);

  if (!policy) {
    return {
      title: "Policy | Global Awakening",
    };
  }

  return {
    title: `${policy.title} | Global Awakening`,
    description: policy.intro,
  };
}

export default async function PolicyRoute({ params }: PolicyRouteProps) {
  const { slug } = await params;
  const policy = getPolicyBySlug(slug);

  if (!policy) {
    notFound();
  }

  return <PolicyPage policy={policy} />;
}
