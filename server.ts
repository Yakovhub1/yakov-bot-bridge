import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function sendMessage(to, text) {
await fetch("https://api.prompt2bot.com/api", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
endpoint: "inject-context",
payload: { secret: P2B_SECRET, context: text, preferredNetwork: "whatsapp", targetConversationId: String(to).replace(/\D/g, '') + "@c.us" }
})
});
}
async function updateAirtable(id, fields) {
await fetch("https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + id, {
method: 'PATCH',
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
body: JSON.stringify({ fields })
});
}
async function runCheck() {
const now = DateTime.now().setZone('Asia/Jerusalem');
let report = "--- Yakov Bot FULL DIAGNOSTIC ---\nTime: " + now.toString() + "\n\n";
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
const res = await fetch(url, { headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY } });
const data = await res.json();
if (!data.records) return report + "ERROR: No records found.";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;
  report += "CHECKING USER: " + f.Phone + " (Status: " + f.Status + ")\n";

  // 1. נדנוד
  if (f.Status === 'InProgress' && f.LastInteraction) {
    const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
    const diff = now.diff(lastInt, 'minutes').minutes;
    report += " - Nudge: " + diff.toFixed(1) + " mins since reply. nudge_sent: " + (f.nudge_sent || "false") + "\n";
    if (diff >= 2 && f.nudge_sent !== true) {
      report += " - ACTION: Sending Nudge...\n";
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר?");
      await updateAirtable(record.id, { nudge_sent: true });
    }
  }

  // 2. תזכורת בוקר (מותאם לטסט - שעה 10:00)
  if (now.hour === 10) {
    report += " - Morning Check: Asked_Reminders is " + (f.Asked_Reminders || "false") + "\n";
    if (!f.Asked_Reminders) {
      report += " - ACTION: Sending Morning Question...\n";
      await sendMessage(f.Phone, "בוקר אור! כאן יעקב. רציתי לשאול - האם תרצה שאשלח לך הודעה קצרה בסוף כל יום כדי לשאול לשלומך, או שמעדיף רק תזכורות שקילה מדי פעם?");
      await updateAirtable(record.id, { Asked_Reminders: true });
    }
  }
  report += "----------------------------\n";
}

} catch (err) { report += "ERROR: " + err.message + "\n"; }
return report + "Diagnostic Complete.";
}
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") return new Response(await runCheck());
return new Response("Bridge is alive! Diagnostic path: /nudge");
}, { port: 8080 });
