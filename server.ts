import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function sendMessage(to, text) {
try {
await fetch("https://api.prompt2bot.com/api", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
endpoint: "inject-context",
payload: {
secret: P2B_SECRET,
context: text,
preferredNetwork: "whatsapp",
targetConversationId: String(to).replace(/\D/g, '') + "@c.us"
}
})
});
} catch (e) { console.log("Error sending:", e); }
}
async function updateAirtable(id, fields) {
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + id;
await fetch(url, {
method: 'PATCH',
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
body: JSON.stringify({ fields })
});
} catch (e) { console.log("Error update:", e); }
}
async function runCheck() {
const now = DateTime.now().setZone('Asia/Jerusalem');
let report = "--- Yakov Bot Production Report ---\nTime: " + now.toString() + "\n\n";
try {
const res = await fetch("https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users", {
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY }
});
const data = await res.json();
if (!data.records) return report + "No records found.";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;

  // 1. נדנוד - 2 דקות
  if (f.Status === 'InProgress' && f.LastInteraction && f.nudge_sent !== true) {
    const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
    const diff = now.diff(lastInt, 'minutes').minutes;
    if (diff >= 2) {
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)");
      await updateAirtable(record.id, { nudge_sent: true });
    }
  }

  // 2. תזכורת בוקר - שעה 10
  if (now.hour === 10 && now.minute = now.startOf('day'));
    const isWeighDayEve = (now.weekday === 2 || now.weekday === 5); // Tuesday/Friday evenings

just now

    if (f.Daily_reminder || (isActive && isWeighDayEve)) {
      let msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
      if (f.Has_Tablets) msg += " וזכרת לקחת את הטבליות שלך?";
      if (isActive && isWeighDayEve) msg += "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן.";
      await sendMessage(f.Phone, msg);
      await new Promise(r => setTimeout(r, 20000)); // Delay between users
    }
  }
}

} catch (err) { report += "Error: " + err.message; }
return report + "Done.";
}
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") {
const result = await runCheck();
return new Response(result);
}
return new Response("Bridge is alive!");
}, { port: 8080 });
