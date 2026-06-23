import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const brands = await prisma.brand.findMany()
  brands.forEach(b => {
    console.log(`Brand ${b.id} (${b.name}):`, b.brandConfig)
  })
}
main()
