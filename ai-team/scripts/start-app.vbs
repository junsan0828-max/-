' 로그온 시 조용히(터미널 창 없이) AI OFFICE 데스크톱 앱을 실행한다.
' 알리고 SMS/알림톡은 이 앱이 켜져 있어야만 고정 IP로 실제 발송되므로, PC가 켜지면
' 사람이 따로 실행하지 않아도 항상 상주하도록 Windows 로그온 트리거로 이 스크립트를 건다.
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\junsa\-\ai-team"
objShell.Run "cmd /c npm start", 0, False
