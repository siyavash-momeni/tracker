import { NextResponse } from 'next/server';
import { prisma } from "@/prisma.client"; // Adapte le chemin selon ton projet

// GET /api/notes
export async function GET() {
  try {
    const notes = await prisma.notes.findMany({ 
      orderBy: { createdAt: "desc" } 
    });
    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json({ error: "Error during deletion" }, { status: 500 });
  }
}

// POST /api/notes
export async function POST(request: Request) {
  try {
    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const note = await prisma.notes.create({
      data: { title, content }
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}