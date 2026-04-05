import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function runCheck() {
let report = "--- Yakov Bot PRODUCTION Report ---\n";
const now = DateTime.now().setZone('Asia/Jerusalem');
report += "Current Israel Time: " + now.toString() + "\n\n";
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
const res = await fetch(url, { headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY } });
const data = await res.json();
if (!data.records) return report + "ERROR: Could not fetch records.";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;
  report += "User: " + f.Phone + " (Status: " + f.Status + ")\n";

  // 1. נדנוד - רק בסטטוס InProgress
  if (f.Status === 'InProgress' && f.LastInteraction) {
    const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
    const diff = now.diff(lastInt, 'minutes').minutes;
    report += " -> Nudge Check: " + diff.toFixed(1) + " min since reply. Sent: " + (f.nudge_sent || "false") + "\n";
    if (diff >= 2 && f.nudge_sent !== true) {
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר?", P2B_SECRET);
      await updateAirtable(record.id, { nudge_sent: true });
    }
  }

  // 2. תזכורת בוקר - בודק בכל סטטוס (גם MenuSent)
  if (now.hour === 11) {
    const created = DateTime.fromISO(record.createdTime).setZone('Asia/Jerusalem');
    const hoursSinceJoin = now.diff(created, 'hours').hours;
    report += " -> Morning Check: Joined " + hoursSinceJoin.toFixed(1) + " hours ago. Asked: " + (f.Asked_Reminders || "false") + "\n";
    if (hoursSinceJoin > 12 && !f.Asked_Reminders) {
      await sendMessage(f.Phone, "בוקר אור! כאן יעקב. רציתי לשאול - האם תרצה שאשלח לך הודעה קצרה בסוף כל יום כדי לשאול לשלומך, או שמעדיף רק תזכורות שקילה מדי פעם?", P2B_SECRET);
      await updateAirtable(record.id, { Asked_Reminders: true });
    }
  }
  report += "----------------------------\n";
}

} catch (err) { report += "CRITICAL ERROR: " + err.message + "\n"; }
return report;
}
async function sendMessage(to, text, secret) {
await fetch('https://api.prompt2bot.com/api', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
endpoint: "inject-context",
payload: { secret, context: text, preferredNetwork: "whatsapp", targetConversationId: String(to).replace(/\D/g, '') + "@c.us" }
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
1 minute ago
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") return new Response(await runCheck());
return new Response("Yakov System Live! Use /nudge for diagnostic.");
}, { port: 8080 });
