import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma"; // Vérifie bien que c'est le bon chemin vers ton instance
import { auth } from "@clerk/nextjs/server";

// GET /api/notes - Fetch only the notes of the connected user
export async function GET() {
  try {
    const { userId } = await auth();

    // If no user is logged in, we return an empty list or unauthorized
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await prisma.notes.findMany({ 
      where: {
        userId: userId // 🔒 Security: Only get notes belonging to this clerkId
      },
      orderBy: { createdAt: "desc" } 
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json({ error: "Error while fetching notes" }, { status: 500 });
  }
}

// POST /api/notes - Create a note linked to the connected user
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const note = await prisma.notes.create({
      data: { 
        title, 
        content,
        userId: userId // 🔗 Link the note to the user automatically
      }
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json({ error: "Error while creating note" }, { status: 500 });
  }
}