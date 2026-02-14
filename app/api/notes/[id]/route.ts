import { NextResponse } from 'next/server';
import { prisma } from "@/prisma.client";

interface RouteParams {
  params: Promise<{ id: string }>; // On précise que c'est une Promise désormais
}

// DELETE /api/notes/[id]
export async function DELETE(request: Request, { params }: RouteParams) {
  // ICI : On ajoute le "await" pour déballer l'ID
  const { id } = await params;

  try {
    await prisma.notes.delete({ 
      where: { id } 
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}

// Applique la même chose pour tes autres méthodes dans ce fichier :
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params; // Ajoute await ici aussi
  const note = await prisma.notes.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params; // Et ici aussi
  const { title, content } = await request.json();
  const updated = await prisma.notes.update({
    where: { id },
    data: { title, content }
  });
  return NextResponse.json(updated);
}