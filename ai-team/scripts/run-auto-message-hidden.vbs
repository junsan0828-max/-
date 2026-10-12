' 13시 자동문자를 창 없이(숨김) 실행한다. 스케줄러 작업 "AI-Office-AutoMessage-1310"이 호출한다.
' 로그: ai-team\output\auto-message-task.log
Set sh = CreateObject("WScript.Shell")
cmd = "cmd.exe /c cd /d ""C:\Users\junsa\-\ai-team"" && ""C:\Program Files\nodejs\npm.cmd"" run auto-message >> ""C:\Users\junsa\-\ai-team\output\auto-message-task.log"" 2>&1"
' 0 = 창 숨김, True = 끝날 때까지 기다리고 종료 코드를 그대로 돌려준다
rc = sh.Run(cmd, 0, True)
WScript.Quit rc
