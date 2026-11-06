import { prisma } from "@/lib/prisma";
import { sirahAdmin, sirahResponseError, privateJson } from "@/lib/sirah/http";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
export async function GET(request: Request) {
  try {
    await sirahAdmin(request);
    const page = Math.max(
      1,
      Math.min(
        10000,
        Number(new URL(request.url).searchParams.get("page")) || 1,
      ),
    );
    const where = { course: { slug: SIRAH_SLUG }, sirahOrder: null };
    const [total, rows] = await Promise.all([
      prisma.registration.count({ where }),
      prisma.registration.findMany({
        where,
        take: 25,
        skip: (page - 1) * 25,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          paymentReference: true,
          selectedCountryName: true,
          status: true,
          pricingSnapshot: true,
          user: { select: { fullName: true, email: true } },
          payment: { select: { amount: true, currency: true, status: true } },
          enrollment: { select: { status: true } },
        },
      }),
    ]);
    return privateJson({
      page,
      total,
      rows: rows.map((row) => ({
        id: row.id,
        reference: row.paymentReference,
        name: row.user.fullName,
        email: row.user.email,
        country: row.selectedCountryName,
        paymentStatus: row.payment?.status || "UNPAID",
        enrolmentStatus: row.enrollment?.status || "PENDING",
        historicalAmount: row.payment?.amount,
        historicalCurrency: row.payment?.currency,
        unitNotice:
          row.payment?.currency === "GBP"
            ? "Stored GBP minor units (pence)"
            : "Original legacy stored units; preserved without repricing",
      })),
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
