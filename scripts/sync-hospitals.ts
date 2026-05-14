/**
 * Alopop 전국 동물병원 공공데이터 동기화 CLI 스크립트
 * 
 * 사용법: cd c:\home\alopop && npx tsx scripts/sync-hospitals.ts --clear
 * 옵션:
 *   --clear        기존 데이터 삭제 후 재삽입
 *   --region 부천시  특정 지역만 필터
 *   --max-pages 200 최대 페이지 수 (기본 200)
 */

import { PrismaClient } from "@prisma/client";
import proj4 from "proj4";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const API_KEY = process.env.DATA_GO_KR_API_KEY;
const BASE_URL = "http://apis.data.go.kr/1741000/animal_hospitals/info";
const PAGE_SIZE = 100;

proj4.defs("EPSG:5174", "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43");

interface ApiItem {
  BPLC_NM: string;
  ROAD_NM_ADDR: string;
  LOTNO_ADDR: string;
  SALS_STTS_NM: string;
  TELNO: string;
  CRD_INFO_X: string;
  CRD_INFO_Y: string;
}

function parseItem(item: ApiItem) {
  const name = (item.BPLC_NM || "").trim();
  const address = (item.ROAD_NM_ADDR || item.LOTNO_ADDR || "").trim();
  const phone = (item.TELNO || "").replace(/\s+/g, "").trim();
  const status = item.SALS_STTS_NM || "";

  if (!status.includes("영") && !status.includes("정")) return null;
  if (!name || !address) return null;

  const tmX = parseFloat(item.CRD_INFO_X || "0");
  const tmY = parseFloat(item.CRD_INFO_Y || "0");
  if (!tmX || !tmY) return null;

  const [lng, lat] = proj4("EPSG:5174", "EPSG:4326", [tmX, tmY]);
  const rLat = Math.round(lat * 10000) / 10000;
  const rLng = Math.round(lng * 10000) / 10000;
  if (rLat < 33 || rLat > 39 || rLng < 124 || rLng > 132) return null;

  const isEmergency = /24시|응급|메디컬센터|의료센터/.test(name);

  return {
    name, address, phone,
    website: null, lat: rLat, lng: rLng,
    openHours: isEmergency ? "24시간" : null,
    specialties: null,
    isEmergency,
  };
}

async function fetchPage(page: number) {
  const params = new URLSearchParams({
    serviceKey: API_KEY!,
    pageNo: String(page),
    numOfRows: String(PAGE_SIZE),
    type: "json",
  });

  const res = await fetch(`${BASE_URL}?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);

  const json = await res.json();
  const body = json.response?.body;
  const items: ApiItem[] = body?.items?.item || [];
  return { items: Array.isArray(items) ? items : [items], totalCount: body?.totalCount || 0 };
}

async function syncHospitals(region?: string, clear = false, maxPages = 200) {
  if (!API_KEY) { console.error("❌ DATA_GO_KR_API_KEY 미설정. .env 파일을 확인하세요."); process.exit(1); }

  console.log("🏥 공공데이터포털 전국 동물병원 동기화 시작...");
  if (region) console.log(`   📍 지역 필터: ${region}`);

  if (clear) {
    const d = await prisma.hospital.deleteMany();
    console.log(`   🗑️  기존 ${d.count}건 삭제`);
  }

  let page = 1, inserted = 0, updated = 0, skipped = 0, totalCount = 0;

  while (page <= maxPages) {
    try {
      const result = await fetchPage(page);
      totalCount = result.totalCount;
      if (result.items.length === 0) break;

      for (const item of result.items) {
        const parsed = parseItem(item);
        if (!parsed) { skipped++; continue; }
        if (region && !parsed.address.includes(region)) { skipped++; continue; }

        const existing = await prisma.hospital.findFirst({
          where: { name: parsed.name, address: parsed.address },
        });

        if (existing) {
          await prisma.hospital.update({ where: { id: existing.id }, data: parsed });
          updated++;
        } else {
          await prisma.hospital.create({ data: parsed });
          inserted++;
        }
      }

      process.stdout.write(`\r   📄 ${Math.min(page * PAGE_SIZE, totalCount)}/${totalCount} (신규:${inserted} 업데이트:${updated} 스킵:${skipped})`);
      page++;
      if (page * PAGE_SIZE > totalCount) break;
      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      console.error(`\n   ⚠️  페이지 ${page}:`, error);
      break;
    }
  }

  const finalCount = await prisma.hospital.count();
  console.log(`\n\n✅ 완료! 신규:${inserted} | 업데이트:${updated} | 스킵:${skipped} | DB총:${finalCount}건`);

  // 📦 JSON 내보내기 (클라이언트 동기화용)
  await exportToJson();
}

async function exportToJson() {
  const hospitals = await prisma.hospital.findMany({
    select: {
      id: true, name: true, address: true, phone: true,
      website: true, lat: true, lng: true,
      openHours: true, specialties: true, isEmergency: true,
    },
    orderBy: { name: "asc" },
  });

  const outDir = path.resolve(__dirname, "..", "public", "data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "hospitals.json");
  fs.writeFileSync(outPath, JSON.stringify(hospitals));

  console.log(`📦 JSON 내보내기: ${outPath} (${hospitals.length}건, ${Math.round(fs.statSync(outPath).size / 1024)}KB)`);
}

const args = process.argv.slice(2);
const ri = args.indexOf("--region"), mpi = args.indexOf("--max-pages");
syncHospitals(
  ri !== -1 ? args[ri + 1] : undefined,
  args.includes("--clear"),
  mpi !== -1 ? parseInt(args[mpi + 1]) : 200
).catch(console.error).finally(() => prisma.$disconnect());
