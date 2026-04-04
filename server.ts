import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_PAT");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const P2B_SECRET = Deno.env.get("PROMPT2BOT_TOKEN");
async function getUsers() {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
try {
const res = await fetch(url, {
headers: { Authorization: "Bearer " + AIRTABLE_API_KEY },
});
const data = await res.json();
return data.records || [];
} catch (e) {
console.error("Airtable fetch error:", e);
return [];
}
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
} catch (e) {
console.error("P2B send error:", e);
}
}
async function runAutomation() {
const now = DateTime.now().setZone("Asia/Jerusalem");
console.log("--- Automation Run: " + now.toString() + " ---");
const users = await getUsers();
for (const user of users) {
const f = user.fields;
if (!f.Phone) continue;

// 1. Onboarding Nudge (5 mins)
if (f.Status === "InProgress" && f.LastInteraction && f.nudge_sent !== true) {
  const lastInt = DateTime.fromISO(f.LastInteraction).setZone("Asia/Jerusalem");
  const diff = now.diff(lastInt, "minutes").minutes;
  if (diff >= 5 && diff  12 && hoursSinceJoined < 36 && !f.Asked_Reminders) {
      await sendMessage(f.Phone, "בוקר אור! כאן יעקב. רציתי לשאול - האם תרצה שאשלח לך הודעה קצרה בסוף כל יום כדי לשאול לשלומך, או שמעדיף רק תזכורות שקילה מדי פעם?");
      await fetch("https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + user.id, {
         method: "PATCH",
         headers: { Authorization: "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
         body: JSON.stringify({ fields: { Asked_Reminders: true } }),
      });
    }
  }

6 minutes ago

  // 10:00 Expiry Check
  if (now.hour === 10 && f.Paid_Until) {
    const paidUntil = DateTime.fromISO(f.Paid_Until).setZone("Asia/Jerusalem");
    if (paidUntil.hasSame(now, 'day')) {
      await sendMessage(f.Phone, "שלום, המנוי שלך מסתיים היום. כדי להמשיך ליהנות מהליווי, ניתן לפנות לניסים בטלפון: 0503493737 להסדרת תשלום.");
    }
  }

  // 20:00 Evening Reminders
  if (now.hour === 20) {
    let msg = "היי, ערב טוב! איך עבר עליך היום מבחינת הארוחות? היה משהו קשה? זכרת לשתות מספיק מים?";
    if (f.Has_Tablets) msg += " וזכרת לקחת את הטבליות שלך?";

    const isWeighDay = now.weekday === 3 || now.weekday === 6;
    if (isWeighDay) {
      msg += "\nוחשוב מאוד: מחר בבוקר יום שקילה! אל תשכח להישקל ולעדכן אותי כאן.";
    }

    if (now.weekday === 1 && !f.Has_Tablets) {
      msg += "\nדרך אגב, יש לנו טבליות מיוחדות שעוזרות לתחושת שובע. תרצה לשמוע פרטים?";
    }

    if (f.Daily_reminder || isWeighDay) {
      await sendMessage(f.Phone, msg);
    }
  }
}

}
}
const handler = async (req: Request): Promise => {
const url = new URL(req.url);
if (url.pathname === "/nudge") {
await runAutomation();
return new Response("Automation run completed", { status: 200 });
}
return new Response("Bridge is alive!", { status: 200 });
};
serve(handler, { port: 8080 });
