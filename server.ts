import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SPREADSHEET_ID = "1i2lLDNnPcgYJDXOQ0MjFtV3Qpki9Rm6I_WriBQVE4e8";
const SHEET_NAME = "Sheet1";

async function appendToSheet(data: any) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:H:append?valueInputOption=USER_ENTERED`;
  
  const row = [
    new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
    data.phone || "",
    data.name || "",
    data.gender || "",
    data.height || "",
    data.weight || "",
    data.goal_weight || "",
    data.menu || ""
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("GOOGLE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [row],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  if (req.method === "POST" && url.pathname === "/append") {
    try {
      const body = await req.json();
      await appendToSheet(body);
      return new Response(JSON.stringify({ success: true, message: "נתונים נשמרו בהצלחה!" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error:", error.message);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Bridge is alive!", { status: 200 });
};

console.log("Server starting...");
serve(handler, { port: 8080 });
