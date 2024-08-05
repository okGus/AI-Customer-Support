import { NextResponse } from "next/server";
export async function POST(req: Request) {
    const body = await req.json() as string;
    console.log(body);
    return NextResponse.json({ message: 'Testing Post request' });
}