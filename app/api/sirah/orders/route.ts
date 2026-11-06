import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, attachSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { sirahRegistrationSchema } from "@/lib/sirah/validation";
import {
  registerSirah,
  publicSirahOrder,
  SirahError,
} from "@/services/sirah-registration.service";
import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const parsed = sirahRegistrationSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Please check the highlighted registration fields.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    const user = await getCurrentUser();
    if (user && user.status !== "ACTIVE")
      throw new SirahError("Your account is not active.", 403);
    const result = await registerSirah(parsed.data, user?.id);
    const response = privateJson({
      order: await publicSirahOrder(result.orderId, result.userId),
      message: result.existing
        ? "Your saved course registration already exists. Its current payment and enrolment status are shown below."
        : "Registration created. Payment is outstanding; enrolment is not yet confirmed.",
    });
    if (!user) await attachSessionCookie(response, result.userId);
    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        {
          error:
            "This registration or email already exists. Please sign in and open your saved registration.",
        },
        { status: 409 },
      );
    return sirahResponseError(error);
  }
}
export async function GET() {
  try {
    const user = await sirahUser();
    const rows = await prisma.sirahOrder.findMany({
      where: { userId: user.id, course: { slug: SIRAH_SLUG } },
      select: {
        id: true,
        reference: true,
        paymentState: true,
        enrolmentState: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return privateJson({ orders: rows });
  } catch (error) {
    return sirahResponseError(error);
  }
}
