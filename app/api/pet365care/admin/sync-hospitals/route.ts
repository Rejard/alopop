import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import proj4 from 'proj4';

const API_KEY = process.env.DATA_GO_KR_API_KEY;
const BASE_URL = 'http://apis.data.go.kr/1741000/animal_hospitals/info';

// EPSG:5174 (Bessel 중부원점 TM) → EPSG:4326 (WGS84)
proj4.defs('EPSG:5174', '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43');

/**
 * GET: 병원 동기화 상태 조회
 */
export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    if (!user.isAdmin) return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 });

    const count = await prisma.hospital.count();
    return NextResponse.json({ success: true, data: { totalHospitals: count, hasApiKey: !!API_KEY } });
  } catch {
    return NextResponse.json({ success: false, error: '상태 조회 실패' }, { status: 500 });
  }
}

/**
 * POST: 공공데이터 동물병원 동기화
 * body: { region?: string, maxPages?: number, clear?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    if (!user.isAdmin) return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 });
    if (!API_KEY) return NextResponse.json({ success: false, error: 'DATA_GO_KR_API_KEY 미설정' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const region: string = body.region || '';
    const maxPages = Math.min(body.maxPages || 10, 100);
    const clear = body.clear === true;

    // 전체 초기화 옵션
    if (clear) {
      await prisma.hospital.deleteMany();
      console.log('[Hospital Sync] Cleared all hospitals');
    }

    let inserted = 0, updated = 0, skipped = 0;

    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({
        serviceKey: API_KEY,
        pageNo: String(page),
        numOfRows: '100',
        type: 'json',
      });

      let res: Response;
      try {
        res = await fetch(`${BASE_URL}?${params}`, { signal: AbortSignal.timeout(15000) });
      } catch {
        console.error(`[Hospital Sync] Page ${page} timeout`);
        break;
      }
      if (!res.ok) break;

      const json = await res.json();
      const items = json.response?.body?.items?.item || [];
      const rows = Array.isArray(items) ? items : [items];
      if (rows.length === 0) break;

      for (const row of rows) {
        const name = (row.BPLC_NM || '').trim();
        const address = (row.ROAD_NM_ADDR || row.LOTNO_ADDR || '').trim();
        const phone = (row.TELNO || '').replace(/\s+/g, '').trim();
        const status = row.SALS_STTS_NM || '';
        const tmX = parseFloat(row.CRD_INFO_X || '0');
        const tmY = parseFloat(row.CRD_INFO_Y || '0');

        if ((!status.includes('영') && !status.includes('정')) || !name || !address || !tmX || !tmY) { skipped++; continue; }
        if (region && !address.includes(region)) { skipped++; continue; }

        const [lng, lat] = proj4('EPSG:5174', 'EPSG:4326', [tmX, tmY]);
        const rLat = Math.round(lat * 10000) / 10000;
        const rLng = Math.round(lng * 10000) / 10000;
        if (rLat < 33 || rLat > 39 || rLng < 124 || rLng > 132) { skipped++; continue; }

        const isEmergency = /24시|응급|메디컬센터|의료센터/.test(name);
        const data = {
          name, address, phone,
          website: null as string | null,
          lat: rLat, lng: rLng,
          openHours: isEmergency ? '24시간' : null,
          specialties: null as string | null,
          isEmergency,
        };

        const existing = await prisma.hospital.findFirst({ where: { name, address } });
        if (existing) { await prisma.hospital.update({ where: { id: existing.id }, data }); updated++; }
        else { await prisma.hospital.create({ data }); inserted++; }
      }

      // API 호출 제한 대비 간격
      await new Promise(r => setTimeout(r, 300));
      const totalCount = json.response?.body?.totalCount || 0;
      if (page * 100 >= totalCount) break;
    }

    const totalHospitals = await prisma.hospital.count();
    console.log(`[Hospital Sync] Done: inserted=${inserted}, updated=${updated}, skipped=${skipped}, total=${totalHospitals}`);
    return NextResponse.json({ success: true, data: { inserted, updated, skipped, totalHospitals } });
  } catch (error) {
    console.error('[Hospital Sync]', error);
    return NextResponse.json({ success: false, error: '동기화 중 오류' }, { status: 500 });
  }
}
