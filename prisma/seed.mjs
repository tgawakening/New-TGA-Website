import { PrismaClient, RegionGroup } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.upsert({
    where: { slug: "seerah-course" },
    update: {
      title: "The Prophet's Seerah",
      description: "Recorded lessons and weekly live classes.",
      basePrice: 2000,
      currency: "GBP",
      isActive: true,
    },
    create: {
      slug: "seerah-course",
      title: "The Prophet's Seerah",
      description: "Recorded lessons and weekly live classes.",
      basePrice: 2000,
      currency: "GBP",
      isActive: true,
    },
  });

  const discountedCountries = ["PK", "IN", "AF", "BD"];
  for (const countryCode of discountedCountries) {
    await prisma.pricingRule.upsert({
      where: {
        courseId_countryCode: {
          courseId: course.id,
          countryCode,
        },
      },
      update: {
        regionGroup: RegionGroup.SOUTH_ASIA,
        currency: "PKR",
        amount: 2000,
        isDiscounted: true,
      },
      create: {
        courseId: course.id,
        countryCode,
        regionGroup: RegionGroup.SOUTH_ASIA,
        currency: "PKR",
        amount: 2000,
        isDiscounted: true,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
