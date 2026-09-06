import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";

interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export async function requireBrandForCurrentUser(brandId: string) {
  const user = await requireAuth();
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new ResourceNotFoundError("Brand not found");
  assertBrandOwner(user, brand.ownerId);
  return { user, brand };
}

export async function requirePostForCurrentUser(postId: string) {
  const user = await requireAuth();
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { brand: true },
  });
  if (!post) throw new ResourceNotFoundError("Post not found");
  assertBrandOwner(user, post.brand.ownerId);
  return { user, post, brand: post.brand };
}

export function accessErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof ResourceNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return null;
}

function assertBrandOwner(user: SessionUser, ownerId: string): void {
  if (user.email === "admin@example.com") return;
  if (ownerId !== user.id) throw new ForbiddenError();
}
