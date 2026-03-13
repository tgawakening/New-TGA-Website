import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { LoginInput } from "@/lib/validations/registration";

export async function loginWithEmailPassword(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      enrollments: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("Your account is currently not active.");
  }

  return user;
}
