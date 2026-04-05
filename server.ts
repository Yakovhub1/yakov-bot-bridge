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
targetConversationId: String(to).replace(/[^0-9]/g, "") + "@c.us"
}
})
});
} catch (e) { console.error("Send error:", e); }
}
async function updateAirtable(id, fields) {
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + id;
await fetch(url, {
method: "PATCH",
headers: {
"Authorization": "Bearer " + AIRTABLE_API_KEY,
"Content-Type": "application/json"
},
body: JSON.stringify({ fields: fields })
});
} catch (e) { console.error("Airtable update error:", e); }
}
async function runCheck() {
const now = DateTime.now().setZone('Asia/Jerusalem');
let report = "--- Yakov Bot Production Report ---\nTime: " + now.toString() + "\n\n";
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
const res = await fetch(url, {
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY }
});
const data = await res.json();
if (!data.records) return report + "No records found.";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;

  if (f.Status === "InProgress" && f.LastInteraction && f.nudge_sent !== true) {
    const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
    if (now.diff(lastInt, "minutes").minutes >= 2) {
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)");
      await updateAirtable(record.id, { nudge_sent: true });
    }
  }

  if (now.hour === 10 && now.minute >= 49 && now.minute < 58) {
    const created = DateTime.fromISO(record.createdTime).setZone('Asia/Jerusalem');
    if (now.diff(created, "hours").hours > 12 && !f.Asked_Reminders) {
      await sendMessage(f.Phone, "בוקר אור! כאן יעקב. רציתי לשאול - האם תרצה שאשלח לך הודעה קצרה בסוף כל יום כדי לשאול לשלומך, או שמעדיף רק תזכורות שקילה מדי פעם?");
      await updateAirtable(record.id, { Asked_Reminders: true });
    }
  }

  if (now.hour === 21 && now.minute < 15) {
    const paidUntil = f.Paid_Until ? DateTime.fromISO(f.Paid_Until).setZone('Asia/Jerusalem') : null;
    const isActive = paidUntil && paidUntil >= now.startOf('day');
    const isWeighDay = now.weekday === 3 || now.weekday === 6;
    if (f.Daily_reminder || (isActive && isWeighDay)) {
      let msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
      if (f.Has_Tablets) msg += " וזכרת לקחת את הטבליות שלך?";
      if (isActive && isWeighDay) msg += "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן.";
      await sendMessage(f.Phone, msg);
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
return new Response("Bridge is alive! Diagnostic path: /nudge");
}, { port: 8080 });
