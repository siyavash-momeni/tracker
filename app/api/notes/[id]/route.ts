import { NextResponse } from 'next/server';
import { prisma } from "@/prisma.client"; 
import { auth } from "@clerk/nextjs/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/notes/[id]
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 🔒 Security: We only delete if ID matches AND userId matches
    await prisma.notes.delete({ 
      where: { 
        id: id,
        userId: userId // This prevents deleting someone else's note
      } 
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE Error:", error);
    return NextResponse.json({ error: "Error during deletion or note not found" }, { status: 500 });
  }
}

// GET /api/notes/[id]
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const note = await prisma.notes.findUnique({ 
      where: { 
        id: id,
        userId: userId // 🔒 Security: User can only read their own notes
      } 
    });

    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    return NextResponse.json(note);
  } catch (error) {
    return NextResponse.json({ error: "Error fetching note" }, { status: 500 });
  }
}

// PUT /api/notes/[id]
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, content } = await request.json();

    // 🔒 Security: updateMany or update with specific where clause
    // Here we use update but verify the ownership
    const updated = await prisma.notes.update({
      where: { 
        id: id,
        userId: userId // Ensures you can't edit someone else's note
      },
      data: { title, content }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json({ error: "Update failed or unauthorized" }, { status: 500 });
  }
}