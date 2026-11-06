import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import LegacyRegistration from "@/components/sirah/legacy-registration";
import type { Metadata } from "next";
import Link from "next/link";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { SirahRegistrationForm } from "@/components/sirah/registration-form";
import styles from "@/components/sirah/registration.module.css";
export const metadata: Metadata = {
  title: `Register | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};
export default async function SirahRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const resume = (await searchParams).resume;
  if (resume) {
    const user = await getCurrentUser();
    if (!user || user.status !== "ACTIVE") redirect("/login");
    const registration = await prisma.registration.findFirst({
      where: {
        id: resume,
        userId: user.id,
        course: { slug: "seerah-course" },
        sirahOrder: null,
      },
      select: { id: true },
    });
    if (!registration) redirect("/seerah/register");
    return <LegacyRegistration />;
  }
  return (
    <main className={`${styles.page} ${sirahFont.variable}`}>
      <Link href="/seerah">← Back to the course</Link>
      <SirahRegistrationForm />
    </main>
  );
}
