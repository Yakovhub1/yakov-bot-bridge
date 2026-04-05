import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function sendMessage(to: string, text: string) {
try {
await fetch("https://api.prompt2bot.com/api", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
endpoint: "inject-context",
payload: { secret: P2B_SECRET, context: text, preferredNetwork: "whatsapp", targetConversationId: String(to).replace(/\D/g, '') + "@c.us" }
})
});
} catch (e) { console.error("Error sending message:", e); }
}
async function updateAirtable(id: string, fields: any) {
try {
await fetch(https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Yakov_Users/${id}, {
method: 'PATCH',
headers: { "Authorization":Bearer ${AIRTABLE_API_KEY}, "Content-Type": "application/json" },
body: JSON.stringify({ fields })
});
} catch (e) { console.error("Error updating Airtable:", e); }
}
async function runCheck() {
const now = DateTime.now().setZone('Asia/Jerusalem');
let report = "--- Yakov Bot FULL PRODUCTION Report ---\nTime: " + now.toString() + "\n\n";
try {
const url =https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Yakov_Users;
const res = await fetch(url, { headers: { "Authorization":Bearer ${AIRTABLE_API_KEY} } });
const data = await res.json();
if (!data.records) return report + "ERROR: No records found.";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;
  report += "User: " + f.Phone + " (Status: " + f.Status + ")\n";

  // 1. נדנוד - 2 דקות
  if (f.Status === 'InProgress' && f.LastInteraction) {
    const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
    const diff = now.diff(lastInt, 'minutes').minutes;
    if (diff >= 2 && f.nudge_sent !== true) {
      report += " -> ACTION: Sending Nudge...\n";
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)");
      await updateAirtable(record.id, { nudge_sent: true });
      await new Promise(r => setTimeout(r, 20000));
    }
  }

  // 2. תזכורת בוקר - 10:00
  if (now.hour === 10 && now.minute  ACTION: Asking for daily reminders...\n";
      await sendMessage(f.Phone, "בוקר אור! כאן יעקב. רציתי לשאול - האם תרצה שאשלח לך הודעה קצרה בסוף כל יום כדי לשאול לשלומך, או שמעדיף רק תזכורות שקילה מדי פעם?");
      await updateAirtable(record.id, { Asked_Reminders: true });
      await new Promise(r => setTimeout(r, 20000));
    }
  }

  // 3. תזכורות ערב - 21:00
  if (now.hour === 21 && now.minute = now.startOf('day');
    const isWeighDayEve = now.weekday === 2 || now.weekday === 5; // שלישי ושישי בערב (לפני שקילה ברביעי ושבת)

2 minutes ago

    if (f.Daily_reminder || (isActive && isWeighDayEve)) {
      report += " -> ACTION: Sending Evening Message...\n";
      let msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
      if (f.Has_Tablets) msg += " וזכרת לקחת את הטבליות שלך?";
      if (isActive && isWeighDayEve) msg += "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן.";

      await sendMessage(f.Phone, msg);
      await new Promise(r => setTimeout(r, 20000));
    }
  }
  report += "----------------------------\n";
}

} catch (err) { report += "ERROR: " + err.message + "\n"; }
return report + "Process Complete.";
}
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") return new Response(await runCheck());
return new Response("Yakov System Live! /nudge for diagnostic.");
}, { port: 8080 });
