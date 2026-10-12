import { NextResponse } from "next/server";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { divineBondsSchema } from "@/lib/validations/divine-bonds";
import { submitDivineBondsInterest } from "@/services/divine-bonds.service";

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 10000) return NextResponse.json({ error: "Submission is too large." }, { status: 413 });
    const parsed = divineBondsSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return NextResponse.json({ error: "Please check your contact details, interest and consent." }, { status: 400 });
    if (parsed.data.website) return NextResponse.json({ message: "Thank you for your interest." });
    const result = await submitDivineBondsInterest(parsed.data);
    return NextResponse.json({ message: "Your interest has been recorded. TGA will contact you about Divine Bonds.", ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid submission." : "We could not save your interest. Please try again shortly." }, { status: error instanceof SyntaxError ? 400 : 503 });
  }
}
