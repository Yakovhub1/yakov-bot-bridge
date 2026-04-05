import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function runCheck() {
let report = "--- Yakov Bot Status Report ---\n";
const now = DateTime.now().setZone('Asia/Jerusalem');
report += "Time: " + now.toString() + "\n\n";
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !P2B_SECRET) {
return report + "ERROR: Missing API Keys in Render settings.";
}
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
const res = await fetch(url, { headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY } });
const data = await res.json();

if (!data.records) return report + "RESULT: No records found.";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;
  report += "User: " + f.Phone + " (Status: " + f.Status + ")\n";

  // 1. לוגיקת נדנוד (InProgress בלבד)
  if (f.Status === 'InProgress' && f.LastInteraction) {
    const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
    const diff = now.diff(lastInt, 'minutes').minutes;
    report += " - Nudge check: " + diff.toFixed(1) + " mins since reply. nudge_sent: " + (f.nudge_sent || "false") + "\n";

    if (diff >= 2 && f.nudge_sent !== true) {
      report += " - ACTION: Sending nudge... ";
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)", P2B_SECRET);
      await updateAirtable(record.id, { nudge_sent: true });
      report += "Done.\n";
    }
  }

  // 2. תזכורת בוקר (09:00)
  if (now.hour === 10) {
    const created = DateTime.fromISO(record.createdTime).setZone('Asia/Jerusalem');
    const hoursSinceJoined = now.diff(created, 'hours').hours;
    report += " - Morning check: Hours since join: " + hoursSinceJoined.toFixed(1) + ". Asked: " + (f.Asked_Reminders || "false") + "\n";

    if (hoursSinceJoined > 12 && !f.Asked_Reminders) {
      report += " - ACTION: Asking about reminders... ";
      await sendMessage(f.Phone, "בוקר אור! כאן יעקב. רציתי לשאול - האם תרצה שאשלח לך הודעה קצרה בסוף כל יום כדי לשאול לשלומך, או שמעדיף רק תזכורות שקילה מדי פעם?", P2B_SECRET);
      await updateAirtable(record.id, { Asked_Reminders: true });
      report += "Done.\n";
    }
  }

  // 3. תזכורות ערב (21:00)
  if (now.hour === 21) {
    const paidUntil = f.Paid_Until ? DateTime.fromISO(f.Paid_Until).setZone('Asia/Jerusalem') : null;
    const isActive = paidUntil && paidUntil >= now.startOf('day');
    const isWeighDay = now.weekday === 3 || now.weekday === 6;
    report += " - Evening check: Active: " + isActive + ". Daily requested: " + (f.Daily_reminder || "false") + "\n";

2 minutes ago

    if (f.Daily_reminder || (isActive && isWeighDay)) {
      let msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
      if (f.Has_Tablets) msg += " וזכרת לקחת את הטבליות שלך?";
      if (isActive && isWeighDay) msg += "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן.";

      report += " - ACTION: Sending evening message... ";
      await sendMessage(f.Phone, msg, P2B_SECRET);
      report += "Done.\n";
      await new Promise(r => setTimeout(r, 20000)); // הפרש 20 שניות
    }
  }
  report += "----------------------------\n";
}

} catch (err) { report += "ERROR: " + err.message + "\n"; }
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
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + id;
await fetch(url, {
method: 'PATCH',
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
body: JSON.stringify({ fields })
});
}
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") {
return new Response(await runCheck());
}
return new Response("Bridge is alive!");
}, { port: 8080 });
