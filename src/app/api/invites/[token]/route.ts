import { NextRequest, NextResponse } from "next/server";
import { getInviteByToken } from "@/lib/db/team";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  if (!invite) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(invite);
}
