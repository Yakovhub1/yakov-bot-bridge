import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function runCheck() {
let report = "--- Yakov Bot Status Report ---\n";
report += "Time: " + DateTime.now().setZone('Asia/Jerusalem').toString() + "\n\n";
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !P2B_SECRET) {
return report + "ERROR: Missing API Keys in Render Environment settings.";
}
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
const res = await fetch(url, { headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY } });
const data = await res.json();

if (data.error) return report + "AIRTABLE ERROR: " + data.error.message;
if (!data.records || data.records.length === 0) return report + "RESULT: No records found in Airtable.";

const now = DateTime.now().setZone('Asia/Jerusalem');

for (const record of data.records) {
  const f = record.fields;
  if (f.Phone) {
    report += "User: " + f.Phone + "\n - Status: " + f.Status + "\n";
    if (f.Status === 'InProgress' && f.LastInteraction) {
      const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
      const diff = now.diff(lastInt, 'minutes').minutes;
      report += " - Mins since last reply: " + diff.toFixed(1) + "\n";
      
      if (diff >= 2 && f.nudge_sent !== true) {
        report += " - ACTION: Attempting nudge... ";
        const p2bRes = await fetch('https://api.prompt2bot.com/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: "inject-context",
            payload: {
              secret: P2B_SECRET,
              context: "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)",
              preferredNetwork: "whatsapp",
              targetConversationId: String(f.Phone).replace(/\D/g, '') + "@c.us"
            }
          })
        });
        const result = await p2bRes.json();
        report += "Result: " + JSON.stringify(result) + "\n";

        // עדכון איירטייבל
        await fetch(url + "/" + record.id, {
          method: 'PATCH',
          headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { "nudge_sent": true } })
        });
      }
    }
    report += "----------------------------\n";
  }
}

} catch (err) { report += "SYSTEM ERROR: " + err.message + "\n"; }
return report;
}
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") {
const result = await runCheck();
return new Response(result);
}
return new Response("Bridge is alive! Visit /nudge to trigger automation.");
}, { port: 8080 });
