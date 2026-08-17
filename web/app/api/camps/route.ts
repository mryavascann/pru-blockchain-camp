/**
 * GET /api/camps
 *
 * Tüm kampların listesi. HERKESE AÇIK — cüzdan gerekmez.
 * Landing sayfasını ve kamp seçim ekranını besler.
 */
import {listCamps} from "@/lib/content/access";
import {handle, ok} from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const camps = await listCamps();
    return ok({camps});
  });
}
