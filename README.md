# 잔문 殘文 / JANMUN

독립 문학 편집실 · 문학의 바깥을 읽는다.

## 현재 버전
v0.5 — 창립 준비용 정적 웹사이트. 실제 모집, 원고 접수, 판매는 아직 시작하지 않았습니다.

## 파일 구성
- `index.html`: 창립 문서, 총서, 투고 안내와 화면 구조
- `css/style.css`: 디자인 변수, 타이포그래피, 반응형 레이아웃
- `js/main.js`: 메뉴, 검색, 독서 기록, 초안 다운로드
- `assets/janmun-mark.svg`: 로고 시안 및 파비콘
- `assets/afterimage.svg`: 편집 그래픽 '잔상'
- `.nojekyll`: GitHub Pages 정적 파일 배포

## 로컬 실행
VS Code에서 프로젝트 폴더를 연 후 `index.html`을 브라우저로 열거나 Live Server를 사용합니다. 변경 사항은 `git pull`로 내려받습니다.

## 공개 배포
저장소 Settings → Pages → Deploy from a branch → main → /(root) → Save.
예정 주소: https://dffxonnb-cyber.github.io/JANMUN/

## 실제 모집 시스템 연결 전
- 운영자 및 연락처 확정
- 모집 일정, 대상, 제출 형식 및 심사 기준 확정
- 개인정보 처리 안내, 보관 기간 및 삭제 절차 확정
- 원고와 개인정보를 공개 저장소에 넣지 않는 별도 비공개 접수 경로 연결
- 테스트 제출, 권한 점검 후 모집 공개

현재 투고 준비 노트는 브라우저에서 텍스트 파일을 생성할 뿐이며, 입력 내용을 서버로 전송하지 않습니다.
독서 기록과 테마 설정은 이용자의 브라우저에 저장됩니다.
