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
async function updateAirtable(id: string, fields: any) {
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + id;
await fetch(url, {
method: "PATCH",
headers: {
"Authorization": "Bearer " + AIRTABLE_API_KEY,
"Content-Type": "application/json"
},
body: JSON.stringify({ fields })
});
} catch (e) { console.error("Airtable update error:", e); }
}
async function runAutomation() {
const now = DateTime.now().setZone('Asia/Jerusalem');
let report = "--- Yakov Bot Production Report ---\nTime: " + now.toString() + "\n\n";
const res = await fetch("https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users", {
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY }
});
const data = await res.json();
if (!data.records) return report + "No records found.";
for (const record of data.records) {
const f = record.fields;
if (!f.Phone) continue;

// 1. נדנוד (2 דקות לצרכי בדיקה)
if (f.Status === "InProgress" && f.LastInteraction && f.nudge_sent !== true) {
  const lastInt = DateTime.fromISO(f.LastInteraction).setZone('Asia/Jerusalem');
  if (now.diff(lastInt, "minutes").minutes >= 2) {
    await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)");
    await updateAirtable(record.id, { nudge_sent: true });
    await new Promise(r => setTimeout(r, 20000));
  }
}

// 2. תזכורת בוקר (מיוחד לטסט - 10:40)
if (now.hour === 10 && now.minute >= 43 && now.minute  12 && !f.Asked_Reminders) {
    await sendMessage(f.Phone, "בוקר אור! כאן יעקב. רציתי לשאול - האם תרצה שאשלח לך הודעה קצרה בסוף כל יום כדי לשאול לשלומך, או שמעדיף רק תזכורות שקילה מדי פעם?");
    await updateAirtable(record.id, { Asked_Reminders: true });
    await new Promise(r => setTimeout(r, 20000));
  }
}

// 3. תזכורות ערב (21:00)
if (now.hour === 21 && now.minute = now.startOf('day');
  const isWeighDay = now.weekday === 3 || now.weekday === 6;

  if (f.Daily_reminder || (isActive && isWeighDay)) {
    let msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
    if (f.Has_Tablets) msg += " וזכרת לקחת את הטבליות שלך?";
    if (isActive && isWeighDay) msg += "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן.";

    await sendMessage(f.Phone, msg);
    await new Promise(r => setTimeout(r, 20000));
  }
}

}
return report + "Done.";
}
just now
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") {
const result = await runCheck();
return new Response(result);
}
async function runCheck() { return await runAutomation(); }
return new Response("Bridge is alive! Diagnostic path: /nudge");
}, { port: 8080 });
