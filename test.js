const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const brand = await prisma.brand.findFirst()
  console.log(brand.brandConfig)
}
main()
