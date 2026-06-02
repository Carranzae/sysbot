const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@12.com';
    const password = 'CaRrA06Rz6';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            role: 'SUPER_ADMIN',
            password: hashedPassword,
            permissions: ['ALL_ACCESS']
        },
        create: {
            email,
            password: hashedPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPER_ADMIN',
            permissions: ['ALL_ACCESS']
        },
    });

    console.log(`
    =============================================
    Super Admin Created/Updated successfully!
    =============================================
    Email:    ${user.email}
    Password: ${password}
    Role:     ${user.role}
    =============================================
  `);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
