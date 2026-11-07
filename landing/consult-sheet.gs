// 1:1 퍼스널 컨설팅 신청 → 구글 시트 저장용 Apps Script
// 구글 시트에서 [확장 프로그램 > Apps Script]에 이 코드를 붙여넣고 웹 앱으로 배포합니다.

var SHEET_NAME = "컨설팅 신청";
var NOTIFY_BY_EMAIL = true; // 새 신청이 들어오면 시트 소유자 이메일로 알림

var COLUMNS = [
  ["접수 시각", null],
  ["이름", "name"], ["연락처", "phone"], ["경력", "career"], ["관리회원 수", "members"],
  ["고민", "worry"],
  ["매출(3개월 전)", "rev1"], ["매출(2개월 전)", "rev2"], ["매출(지난달)", "rev3"],
  ["3개월 PT 종료 대상", "ended"], ["그중 재등록", "renewed"],
  ["개인정보 동의", "agree"], ["소식 수신 동의", "marketing"],
  ["진행 상태", null], ["메모", null]
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var d = JSON.parse(e.postData.contents);
    if (d.website) return json({ ok: true }); // 스팸 봇
    if (!d.name || !/^01[016789]-?\d{3,4}-?\d{4}$/.test(d.phone || "") || d.agree !== "동의") {
      return json({ ok: false, error: "invalid" });
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(COLUMNS.map(function (c) { return c[0]; }));
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
    }
    var row = COLUMNS.map(function (c) {
      if (c[0] === "접수 시각") return new Date();
      if (c[0] === "진행 상태") return d.status === "대기" ? "대기" : "신규";
      if (!c[1]) return "";
      return clean(d[c[1]]);
    });
    sh.appendRow(row);
    if (NOTIFY_BY_EMAIL) {
      try {
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
          (d.status === "대기" ? "[컨설팅 대기 신청] " : "[컨설팅 신청] ") + clean(d.name) + " · " + clean(d.worry),
          COLUMNS.filter(function (c) { return c[1]; })
            .map(function (c) { return c[0] + ": " + clean(d[c[1]]); }).join("\n") +
          "\n\n시트: " + ss.getUrl());
      } catch (mailErr) { /* 알림 실패는 접수에 영향 없음 */ }
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: "server" });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: "consult-sheet" });
}

// 셀 수식 실행 방지 + 길이 제한
function clean(v) {
  var s = String(v == null ? "" : v).slice(0, 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
