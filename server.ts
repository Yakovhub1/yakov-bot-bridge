import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function getUsers() {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
try {
const res = await fetch(url, { headers: { Authorization: "Bearer " + AIRTABLE_API_KEY } });
const data = await res.json();
return data.records || [];
} catch (e) { return []; }
}
async function sendMessage(to: string, text: string) {
console.log("Sending to " + to + ": " + text);
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
targetConversationId: String(to).replace(/\D/g, "") + "@c.us",
},
}),
});
} catch (e) { console.error("Send error:", e); }
}
async function runAutomation() {
const now = DateTime.now().setZone("Asia/Jerusalem");
console.log("--- Automation Run: " + now.toString() + " ---");
const users = await getUsers();
for (const user of users) {
const f = user.fields;
if (!f.Phone) continue;

// 1. נדנוד (5 דקות)
if (f.Status === "InProgress" && f.LastInteraction && f.nudge_sent !== true) {
  const lastInt = DateTime.fromISO(f.LastInteraction).setZone("Asia/Jerusalem");
  if (now.diff(lastInt, "minutes").minutes >= 5) {
    await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר? אם תרצי להמשיך, פשוט תכתבי לי משהו :)");
    await fetch("https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + user.id, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { nudge_sent: true } }),
    });
    // מחכים 20 שניות כדי לא להציף את המערכת אם יש כמה נדנודים בבת אחת
    await new Promise(r => setTimeout(r, 20000));
  }
}

// 2. תזכורות ערב (21:00)
if (now.hour === 21 && now.minute < 10) {
  let msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
  if (f.Has_Tablets) msg += " וזכרת לקחת את הטבליות שלך?";
  
  const isWeighDay = now.weekday === 3 || now.weekday === 6; // רביעי או שבת
  if (isWeighDay) msg += "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן.";
  
  if (f.Daily_reminder || isWeighDay) {
    await sendMessage(f.Phone, msg);
    // השהייה של 20 שניות בין הודעה להודעה כפי שביקשת
    await new Promise(r => setTimeout(r, 20000));
  }
}

}
}
serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") {
await runAutomation();
return new Response("Done");
}
return new Response("Bridge is alive!");
}, { port: 8080 });
