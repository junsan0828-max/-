# 공유용 문서 (센터 정보 없음)

다른 사람에게 줄 때는 이 폴더(`docs/share/`)의 문서만 준다. 센터 이름·주소·전화·링크는 어디에도 없고, **AI가 처음에 물어봐서** 설정 파일(`config/blog-center.json`)로 만든다.

| 순서 | 문서 | 용도 |
|---|---|---|
| 0 | `00_처음_세팅_인터뷰_프롬프트.md` | AI에 붙여넣으면 센터 정보를 질문으로 받아 설정 파일·폴더·전용 크롬·점검까지 만든다 |
| 1 | `01_논문블로그_글쓰기_프롬프트.md` | 글쓰기 규칙·글 구조·이미지/사진 규칙·설정 항목 표 |
| 2 | `02_블로그에디터_작성_및_PC세팅.md` | 새 PC 세팅 + 에디터 작성 프롬프트 + 문제 해결표 |

- 우리 센터에서 작업할 때는 `config/blog-center.json`(실제 센터 정보)을 그대로 쓴다. 이 파일과 `docs/luna-paper-blog-prompt.md`, `docs/blog-editor-prompt-and-setup.md`는 **내부용**이라 외부에 주지 않는다.
- 코드를 함께 줄 때는 `config/blog-center.json` 을 빼고 `blog-center.example.json` 만 준다.
