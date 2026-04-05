import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function sendMessage(to, text) {
try {
const url = "https://api.prompt2bot.com/api";
const body = JSON.stringify({
endpoint: "inject-context",
payload: {
secret: P2B_SECRET,
context: text,
preferredNetwork: "whatsapp",
targetConversationId: String(to).replace(/\D/g, "") + "@c.us"
}
});
await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body });
} catch (e) { console.log("Send Error"); }
}
async function updateAirtable(id, fields) {
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + id;
const body = JSON.stringify({ fields: fields });
await fetch(url, {
method: "PATCH",
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
body: body
});
} catch (e) { console.log("Update Error"); }
}
async function runCheck() {
const now = DateTime.now().setZone("Asia/Jerusalem");
const hour = now.hour;
const minute = now.minute;
const weekday = now.weekday; // 3 = Wed, 6 = Sat
try {
const listUrl = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
const res = await fetch(listUrl, { headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY } });
const data = await res.json();
if (!data.records) return "No records found";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;

  // 1. נדנוד (2 דקות לצרכי בדיקה)
  if (f.Status === "InProgress" && f.LastInteraction && f.nudge_sent !== true) {
    const last = DateTime.fromISO(f.LastInteraction).setZone("Asia/Jerusalem");
    if (now.diff(last, "minutes").minutes >= 2) {
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)");
      await updateAirtable(record.id, { nudge_sent: true });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // 2. תזכורת בוקר (שעה 10:00 - כל מי שחדש)
  if (hour === 10) {
    if (minute >= 0 && minute  setTimeout(r, 20000)); // 20 שניות השהיה
      }
    }
  }

  // 3. תזכורות ערב (שעה 21:00)
  if (hour === 21) {
    if (minute >= 0 && minute <= 15) {
      const isDaily = (f.Daily_reminder === true);
      const isWeighEve = (weekday === 3 || weekday === 6); // רביעי ושבת בערב

      let shouldSend = false;
      let msg = "";

      if (isDaily === true) {
        shouldSend = true;
        msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
        if (f.Has_Tablets === true) { msg = msg + " וזכרת לקחת את הטבליות שלך?"; }
        if (isWeighEve === true) { msg = msg + "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן."; }
      } else if (isWeighEve === true) {
        shouldSend = true;
        msg = "ערב טוב! כאן יעקב. רק רציתי להזכיר שמחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן :)";
      }

      if (shouldSend === true) {
        await sendMessage(f.Phone, msg);
        await new Promise((r) => setTimeout(r, 20000)); // 20 שניות השהיה בין אנשים
      }
    }
  }
}

} catch (err) { console.log("Run Error"); }
return "Done";
}
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") {
const result = await runCheck();
return new Response(result);
}
return new Response("Yakov System Live");
}, { port: 8080 });
