import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkSirahOrigin,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { createManualDiscountCode } from "@/lib/sirah/manual-discount";
import { SirahError } from "@/services/sirah-registration.service";

const schema = z
  .object({
    code: z.string().trim().max(64).optional(),
    amountMinor: z.number().int().positive().max(100_000_000),
    email: z.union([z.string().email().max(254), z.literal("")]).optional(),
    maxRedemptions: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    // Env full-admin or a DB SIRAH_REVIEWER may issue codes; viewers may not.
    const access = await getSirahWorkspaceAccess(request);
    if (!access?.canCreateDiscountCodes)
      throw new SirahError("You are not authorised to create discount codes.", 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Check the discount amount and options.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    const result = await createManualDiscountCode({
      code: parsed.data.code,
      amountMinor: parsed.data.amountMinor,
      email: parsed.data.email || null,
      maxRedemptions: parsed.data.maxRedemptions,
    });
    return privateJson({
      code: result.code,
      id: result.id,
      maxRedemptions: result.maxRedemptions,
      email: result.email || null,
      message: `Discount code ${result.code} created${result.email ? ` for ${result.email}` : " (unbound)"}.`,
    });
  } catch (error) {
    // Unique codeHash collision -> a code with that text already exists.
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json(
        { error: "That code already exists. Choose a different code." },
        { status: 409 },
      );
    return sirahResponseError(error);
  }
}
