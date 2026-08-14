// 알리고 SMS 발송 중계 서버.
// 목적: 알리고는 발송 서버 IP를 화이트리스트로 제한하는데, Claude Code 클라우드 루틴은 실행마다
// IP가 바뀐다. 이 서비스는 Railway 고정 아웃바운드 IP로 배포해서, 클라우드 루틴이 이 서비스를
// 거쳐 알리고를 호출하면 항상 화이트리스트에 등록된 고정 IP에서 나가게 만든다.
// 외부에 노출되는 엔드포인트라 X-Relay-Secret 헤더로 보호한다.
const http = require("http");

const PORT = process.env.PORT || 3000;
const RELAY_SECRET = process.env.RELAY_SECRET;
const ALIGO_USER_ID = process.env.ALIGO_USER_ID;
const ALIGO_API_KEY = process.env.ALIGO_API_KEY;
const ALIGO_SENDER = process.env.ALIGO_SENDER;

function byteLength(text) {
  let len = 0;
  for (const ch of text) len += ch.charCodeAt(0) > 127 ? 2 : 1;
  return len;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/send") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not found" }));
    return;
  }

  if (!RELAY_SECRET || req.headers["x-relay-secret"] !== RELAY_SECRET) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
    return;
  }

  if (!ALIGO_USER_ID || !ALIGO_API_KEY || !ALIGO_SENDER) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "알리고 환경변수 미설정" }));
    return;
  }

  try {
    const raw = await readBody(req);
    const { receiver, message } = JSON.parse(raw || "{}");
    if (!receiver || !message) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "receiver/message 필요" }));
      return;
    }

    const params = new URLSearchParams({
      key: ALIGO_API_KEY,
      user_id: ALIGO_USER_ID,
      sender: ALIGO_SENDER,
      receiver: String(receiver).replace(/[^0-9]/g, ""),
      msg: message,
      msg_type: byteLength(message) > 90 ? "LMS" : "SMS",
    });

    const aligoRes = await fetch("https://apis.aligo.in/send/", { method: "POST", body: params });
    const data = await aligoRes.json();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`sms-relay listening on ${PORT}`);
});
