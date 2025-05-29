import { prisma } from '@/lib/prisma';
import { Sport } from '@prisma/client';

const celebrities = [
  {
    name: "LeBron James",
    sport: "BASKETBALL" as Sport,
    nationality: "USA",
    biography: "LeBron James is one of the greatest basketball players of all time, known for his versatility, athleticism, and basketball IQ. He has won multiple NBA championships and MVP awards.",
    achievements: [
      "4x NBA Champion",
      "4x NBA MVP",
      "19x NBA All-Star",
      "2x Olympic Gold Medalist"
    ],
    birthDate: new Date("1984-12-30T00:00:00Z").toISOString(),
    position: "Small Forward",
    team: "Los Angeles Lakers"
  },
  {
    name: "Lionel Messi",
    sport: "SOCCER" as Sport,
    nationality: "Argentina",
    biography: "Lionel Messi is widely regarded as one of the greatest football players of all time. Known for his incredible dribbling, vision, and goal-scoring ability.",
    achievements: [
      "8x Ballon d'Or winner",
      "4x Champions League winner",
      "World Cup 2022 winner",
      "Most goals in La Liga history"
    ],
    birthDate: new Date("1987-06-24T00:00:00Z").toISOString(),
    position: "Forward",
    team: "Inter Miami"
  },
  {
    name: "Serena Williams",
    sport: "TENNIS" as Sport,
    nationality: "USA",
    biography: "Serena Williams is one of the greatest tennis players of all time, known for her powerful serve and aggressive playing style.",
    achievements: [
      "23 Grand Slam singles titles",
      "4 Olympic Gold Medals",
      "5 WTA Tour Championships",
      "319 weeks as World No. 1"
    ],
    birthDate: new Date("1981-09-26T00:00:00Z").toISOString(),
    position: "Professional Tennis Player"
  },
  {
    name: "Usain Bolt",
    sport: "ATHLETICS" as Sport,
    nationality: "Jamaica",
    biography: "Usain Bolt is the fastest man in history, holding world records in the 100m and 200m sprints. Known as 'Lightning Bolt' for his incredible speed.",
    achievements: [
      "8 Olympic Gold Medals",
      "11 World Championship Gold Medals",
      "World Record holder in 100m and 200m",
      "Fastest man in history"
    ],
    birthDate: new Date("1986-08-21T00:00:00Z").toISOString(),
    position: "Sprinter"
  }
];

async function main() {
  console.log('🌱 Starting to seed celebrities...');

  for (const celebrity of celebrities) {
    try {
      const existing = await prisma.celebrity.findFirst({
        where: { name: celebrity.name }
      });

      if (!existing) {
        const result = await prisma.celebrity.create({
          data: {
            ...celebrity,
            isActive: true,
            isVerified: true,
            slug: celebrity.name.toLowerCase().replace(/\s+/g, '-')
          }
        });
        console.log(`✅ Created celebrity: ${result.name}`);
      } else {
        console.log(`⏭️  Celebrity already exists: ${celebrity.name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating celebrity ${celebrity.name}:`, error);
    }
  }

  console.log('✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 