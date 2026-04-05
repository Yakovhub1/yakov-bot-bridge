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
payload: {
secret: P2B_SECRET,
context: text,
preferredNetwork: "whatsapp",
targetConversationId: String(to).replace(/\D/g, "") + "@c.us"
}
})
});
}
async function updateAirtable(id, fields) {
await fetch("https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users/" + id, {
method: "PATCH",
headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY, "Content-Type": "application/json" },
body: JSON.stringify({ fields: fields })
});
}
async function runCheck() {
const now = DateTime.now().setZone("Asia/Jerusalem");
let report = "--- Yakov Bot Production Report ---\nTime: " + now.toString() + "\n\n";
try {
const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Yakov_Users";
const res = await fetch(url, { headers: { "Authorization": "Bearer " + AIRTABLE_API_KEY } });
const data = await res.json();
if (!data.records) return report + "ERROR: No records found.";

for (const record of data.records) {
  const f = record.fields;
  if (!f.Phone) continue;

  // 1. נדנוד (2 דקות)
  if (f.Status === "InProgress" && f.LastInteraction) {
    const lastInt = DateTime.fromISO(f.LastInteraction).setZone("Asia/Jerusalem");
    const diff = now.diff(lastInt, "minutes").minutes;
    if (diff >= 2 && f.nudge_sent !== true) {
      await sendMessage(f.Phone, "היי, נתקענו באמצע השאלון... הכל בסדר?");
      await updateAirtable(record.id, { nudge_sent: true });
      await new Promise(r => setTimeout(r, 2000)); // השהיה קצרה
    }
  }

  // 2. תזכורת בוקר (שעה 10:00)
  if (now.hour === 10 && now.minute  setTimeout(r, 20000)); // 20 שניות הפרש
    }
  }

  // 3. תזכורת ערב (שעה 21:00)
  if (now.hour === 21 && now.minute  setTimeout(r, 20000)); // 20 שניות הפרש בין אנשים
    }
  }
}

} catch (err) { report += "ERROR: " + err.message + "\n"; }
return report + "Done.";
}

serve(async (req) => {
const url = new URL(req.url);
if (url.pathname === "/nudge") return new Response(await runCheck());
return new Response("Bridge is alive!");
}, { port: 8080 });
