/**
 * GET|POST /api/cron/sync — Zamanlanmış Notion senkronu (emniyet ağı)
 *
 * Üç katmanlı senkron planının İKİNCİ katmanı. Webhook düşerse, bir olay
 * kaçarsa veya Notion bildirim göndermezse bu devreye girer.
 *
 * ---------------------------------------------------------------------------
 * NEDEN VERCEL CRON DEĞİL, GITHUB ACTIONS
 *
 * Vercel'in Hobby planında cron job'lar GÜNDE EN FAZLA BİR KEZ çalışabilir;
 * daha sık bir ifade (örn. 6 saatte bir) deploy sırasında hata verir.
 *
 * GitHub Actions ise ücretsiz katmanda 6 saatte bir çalışabilir ve repo
 * zaten GitHub'da. Workflow bu adresi `Authorization: Bearer <CRON_SECRET>`
 * başlığıyla çağırır.
 *
 * Webhook birincil katman olduğu için gerçek senkron gecikmesi saniyeler
 * seviyesinde kalıyor; bu uç nokta yalnızca yedek.
 * ---------------------------------------------------------------------------
 */
import {getServerEnv} from "@/lib/env";
import {isNotionConfigured} from "@/lib/env";
import {syncAll} from "@/lib/notion/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(request: Request): Promise<Response> {
  const {CRON_SECRET} = getServerEnv();

  if (!CRON_SECRET) {
    return Response.json(
      {ok: false, error: "CRON_SECRET tanımlı değil — uç nokta kapalı."},
      {status: 503},
    );
  }

  /*
   * Yetki kontrolü. Bu adres internete açık; korunmasaydı herkes senkronu
   * sürekli tetikleyip Notion hız limitini doldurabilirdi.
   *
   * Vercel Cron `Authorization: Bearer <CRON_SECRET>` gönderir;
   * GitHub Actions'da da aynı başlığı kullanıyoruz.
   */
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ok: false, error: "Yetkisiz."}, {status: 401});
  }

  if (!isNotionConfigured()) {
    return Response.json(
      {ok: false, error: "NOTION_TOKEN tanımlı değil — senkron atlandı."},
      {status: 200},
    );
    // 200 dönüyoruz: bu bir hata değil, yapılandırma durumu. Cron'un
    // sürekli "başarısız" bildirmesini istemiyoruz.
  }

  const result = await syncAll("cron");

  return Response.json({
    ok: result.success,
    durationMs: result.durationMs,
    updated: result.camps.reduce((n, c) => n + c.updated + c.created, 0),
    unchanged: result.camps.reduce((n, c) => n + c.unchanged, 0),
    warnings: result.camps.flatMap((c) => c.warnings),
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
