import {
  privateJson,
  sirahReadAccess,
  sirahResponseError,
} from "@/lib/sirah/http";
import {
  sirahPaymentTotals,
  sirahPaymentsCsv,
} from "@/services/sirah-payment-totals.service";
import { SirahError } from "@/services/sirah-registration.service";

/** Read-only payment totals for the admin list filters, and the matching
 * per-payment CSV (?format=csv). Super Admin only. */
export async function GET(request: Request) {
  try {
    const access = await sirahReadAccess(request);
    if (access.role !== "SUPER_ADMIN")
      throw new SirahError("Payment totals are for the super admin only.", 403);
    const params = new URL(request.url).searchParams;
    if (params.get("format") === "csv") {
      const period = [params.get("from"), params.get("to")]
        .filter((value) => value && /^\d{4}-\d{2}-\d{2}$/.test(value))
        .join("-to-");
      return new Response(await sirahPaymentsCsv(params), {
        headers: {
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition": `attachment; filename=sirah-payments${period ? `-${period}` : ""}.csv`,
          "Cache-Control": "private,no-store",
        },
      });
    }
    return privateJson(await sirahPaymentTotals(params));
  } catch (error) {
    return sirahResponseError(error);
  }
}
