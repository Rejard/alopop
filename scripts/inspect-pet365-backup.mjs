import { PrismaClient } from "@prisma/client";
import LZString from "lz-string";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/inspect-pet365-backup.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, isAdmin: true },
  });
  const backup = user
    ? await prisma.pet365Backup.findUnique({ where: { userId: user.id } })
    : null;

  const output = {
    user,
    hasBackup: Boolean(backup),
  };

  if (backup) {
    const raw = LZString.decompressFromUTF16(backup.data);
    let parsed = null;
    try {
      parsed = JSON.parse(raw || "{}");
    } catch (error) {
      output.parseError = String(error);
    }

    const store = parsed?.format === "pet365care-store" ? parsed.store : parsed;
    const pets = Array.isArray(store?.pets) ? store.pets : [];

    output.backupMeta = {
      size: backup.size,
      petCount: backup.petCount,
      version: backup.version,
      updatedAt: backup.updatedAt,
    };
    output.payload = {
      format: parsed?.format || "legacy",
      topKeys: Object.keys(parsed || {}).sort(),
      storeKeys: Object.keys(store || {}).sort(),
      rawChars: raw?.length || 0,
      pets: pets.length,
      petFieldKeys: pets.map((pet) => Object.keys(pet).sort()),
      petDetailPresence: pets.map((pet) => ({
        hasName: hasOwn(pet, "name"),
        hasSpecies: hasOwn(pet, "species"),
        hasBreed: hasOwn(pet, "breed"),
        breedType: typeof pet.breed,
        hasAge: hasOwn(pet, "age"),
        ageType: typeof pet.age,
        hasGender: hasOwn(pet, "gender"),
        genderType: typeof pet.gender,
        hasBirthday: hasOwn(pet, "birthday"),
        birthdayType: typeof pet.birthday,
        hasWeight: hasOwn(pet, "weight"),
        weightType: typeof pet.weight,
        hasNeutered: hasOwn(pet, "isNeutered"),
        neuteredType: typeof pet.isNeutered,
        hasAllergies: hasOwn(pet, "allergies"),
        allergiesType: typeof pet.allergies,
        hasMemo: hasOwn(pet, "memo"),
        memoType: typeof pet.memo,
        vaccinations: Array.isArray(pet.vaccinations) ? pet.vaccinations.length : null,
      })),
      careChecks: Array.isArray(store?.careChecks) ? store.careChecks.length : null,
      activityLogs: Array.isArray(store?.activityLogs) ? store.activityLogs.length : null,
      healthRecords: Array.isArray(store?.healthRecords) ? store.healthRecords.length : null,
      settingsKeys: store?.settings ? Object.keys(store.settings).length : null,
      summary: parsed?.summary || null,
    };
  }

  console.log(JSON.stringify(output, null, 2));
} finally {
  await prisma.$disconnect();
}
