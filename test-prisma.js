const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@syst.com' }
    });
    console.log('User found:', user ? user.email : 'Not found');
    
    if (user) {
      const bcrypt = require('bcrypt');
      const isValid = await bcrypt.compare('nueva123', user.password);
      console.log('Password valid:', isValid);
      console.log('User isActive:', user.isActive);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
