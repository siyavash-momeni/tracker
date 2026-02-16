import { auth, currentUser } from "@clerk/nextjs/server";
// The "@" alias usually points to your project root
import { prisma } from "@/lib/prisma";

export async function checkAndSyncUser() {
  const { userId } = await auth();
  const user = await currentUser();

  // If no session is found, return null
  if (!userId || !user) return null;

  try {
    // Look for the user in your Neon database using the Clerk ID
    let dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    // If the user doesn't exist in the DB, create it
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email: user.emailAddresses[0].emailAddress,
        },
      });
      console.log("✅ New user created in Neon DB:", dbUser.email);
    }

    return dbUser;
  } catch (error) {
    console.error("❌ Error during user synchronization:", error);
    return null;
  }
}