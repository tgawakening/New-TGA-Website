import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { profileUpdateSchema } from "@/lib/validations/profile";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = profileUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid profile update payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          fullName: parsed.data.fullName,
          phoneCountryCode: parsed.data.phoneCountryCode,
          phoneNumber: parsed.data.phoneNumber,
        },
      });

      return tx.studentProfile.upsert({
        where: { userId: user.id },
        update: {
          countryCode: parsed.data.countryCode,
          countryName: parsed.data.countryName,
          timezone: parsed.data.timezone || null,
        },
        create: {
          userId: user.id,
          countryCode: parsed.data.countryCode,
          countryName: parsed.data.countryName,
          timezone: parsed.data.timezone || null,
        },
      });
    });

    return NextResponse.json({
      message: "Profile updated successfully.",
      profile: updatedUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile update failed." },
      { status: 500 },
    );
  }
}
