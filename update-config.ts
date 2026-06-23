import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const brand = await prisma.brand.findUnique({ where: { id: "cmqpjm2zv0001ipouhm38p90l" } })
  if (brand) {
    const config = JSON.parse(brand.brandConfig)
    config.tiktokVideo.enabled = true
    config.tiktokVideo.formats = [
      { id: "self_classification", name: "자기분류형", weight: 3, instruction: "A/B/C 선택" }
    ]
    await prisma.brand.update({
      where: { id: brand.id },
      data: { brandConfig: JSON.stringify(config) }
    })
    console.log("Updated")
  }
}
main()
