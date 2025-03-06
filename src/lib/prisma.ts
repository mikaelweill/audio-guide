import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | undefined;
}

// Ensure Prisma is not used in browser
if (typeof window !== 'undefined') {
  throw new Error('PrismaClient cannot be used in the browser. Use API routes instead.');
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma; 