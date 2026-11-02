import type { Metadata } from 'next';
import LegalDocument, { type LegalSection } from '../../../components/legal/LegalDocument';

export const metadata: Metadata = {
  title: '개인정보처리방침 | PokeSettle',
  description: 'PokeSettle의 정보 처리 항목과 목적, 브라우저 저장소, 외부 서비스 및 이용자 권리를 안내합니다.',
  alternates: { canonical: '/privacy' },
};

const sections: LegalSection[] = [
  { id: 'scope', title: '1. 운영자와 적용 범위', content: <p>강현준(이하 “운영자”)은 PokeSettle 웹 서비스에서 처리하는 정보와 이용자의 권리를 다음과 같이 안내합니다. 서비스는 별도의 회원가입을 제공하지 않으며, 이름, 이메일 주소, 비밀번호를 가입 정보로 수집하지 않습니다.</p> },
  { id: 'collection', title: '2. 처리하는 정보와 목적', content: <><ul><li>임시 세션 식별자: 대화 및 저장한 팀의 접근 권한을 구분하기 위해 처리합니다.</li><li>질문, AI 답변, 선택한 포켓몬과 규칙, 팀 구성, 배틀 입력: 전략 답변 생성, 대화 조회 및 팀 저장에 사용합니다.</li><li>접속 과정의 IP 주소, 요청 URL, 브라우저 정보 및 오류 기록: 서버와 네트워크에서 요청 처리, 보안 및 장애 대응을 위해 처리될 수 있습니다.</li><li>방문 및 이용 정보: Google Analytics가 설정된 경우 방문 통계와 서비스 개선을 위해 처리됩니다.</li></ul><p>질문이나 팀 이름에 본인 또는 타인의 개인정보, 비밀번호와 인증 정보를 입력하지 마세요.</p></> },
  { id: 'storage', title: '3. 쿠키와 브라우저 저장소', content: <><p><code>pokecoach_session</code> 쿠키는 임시 세션을 구분하며 유효기간은 발급 후 7일입니다. 쿠키를 삭제하면 기존 대화와 팀에 접근하지 못할 수 있습니다.</p><p>sessionStorage에는 대화 식별자, 작성 중인 질문과 팀 등 화면 복원에 필요한 정보가 저장됩니다. localStorage에는 관동 포켓몬 수집 기록과 포획 대기 시간이 저장되며 다른 기기와 동기화되지 않습니다.</p><p>브라우저 설정에서 쿠키와 사이트 저장소를 삭제하거나 차단할 수 있습니다. 이 경우 기록 복원과 일부 기능이 제한될 수 있습니다. 브라우저 저장소 삭제는 서버에 저장된 대화와 팀을 삭제하는 기능이 아닙니다.</p></> },
  { id: 'retention', title: '4. 보관과 삭제', content: <><p>대화와 팀은 기능 제공을 위해 서버에 저장됩니다. 대화 삭제 기능을 사용하면 해당 대화와 메시지 및 연결된 배틀 상태가 삭제됩니다. 팀은 팀 삭제 기능으로 삭제할 수 있습니다.</p><p>세션의 7일 유효기간은 접근 권한의 기간이며, 서버에 저장된 데이터의 자동 삭제 기간을 뜻하지 않습니다. 현재 서버 저장 데이터에는 일괄 자동 파기 기간이 설정되어 있지 않습니다. 접근할 수 없는 기록의 삭제 등은 운영자에게 요청할 수 있습니다.</p><p>브라우저의 수집 기록은 직접 사이트 데이터를 삭제할 때까지 남을 수 있으며, 임시 작성 정보는 브라우저의 세션 저장소 수명과 복원 동작에 따릅니다.</p></> },
  { id: 'external', title: '5. 외부 서비스와 정보 전송', content: <><p>AI 답변 생성을 위해 질문, 관련 대화 맥락, 팀 및 배틀 입력과 검색된 참고 자료가 서버에 설정된 AI API 제공자에게 전송됩니다. 기본 API 연동은 OpenAI이며, 제공자의 서버 위치에 따라 국외에서 처리될 수 있습니다. 제공자 측 보관과 처리는 해당 제공자의 정책 및 계약 설정에 따릅니다. <a href="https://developers.openai.com/api/docs/guides/your-data">OpenAI API 데이터 처리 안내</a>에서 상세 내용을 확인할 수 있습니다.</p><p>Google Analytics가 활성화된 경우 Google이 쿠키와 방문 페이지, 기기 및 브라우저 등 이용 정보를 처리할 수 있습니다. <a href="https://policies.google.com/technologies/partner-sites?hl=ko">Google의 파트너 사이트 정보 처리 안내</a>와 <a href="https://tools.google.com/dlpage/gaoptout?hl=ko">Analytics 수집 거부 도구</a>를 확인할 수 있습니다.</p><p>외부 출처 링크를 방문하거나 외부 이미지를 불러오면 해당 제공자에게 접속 정보가 전달될 수 있으며, 해당 사이트의 개인정보처리방침이 적용됩니다.</p></> },
  { id: 'rights', title: '6. 이용자 권리와 보호', content: <><p>이용자는 자신과 관련된 정보의 열람, 정정, 삭제 또는 처리 정지를 요청할 수 있습니다. 운영자는 요청 대상과 권한을 확인한 뒤 관련 법령에 따라 처리합니다. 서비스는 세션별 접근 확인과 HttpOnly 쿠키 등을 통해 기록에 대한 무단 접근을 제한합니다.</p><p>개인정보 문의와 권리 행사 요청은 운영자 강현준에게 <a href="https://github.com/unfl1/pokesettle/issues">GitHub 문의</a>로 연락할 수 있습니다. 공개 문의에는 요청의 종류만 남기고 개인정보, 대화 원문이나 쿠키 값을 공개하지 마세요. 필요한 확인 정보는 별도 전달 방법을 협의하여 받습니다.</p></> },
  { id: 'changes', title: '7. 방침 변경', content: <p>처리 항목이나 외부 서비스 등 중요한 사항이 변경되면 이 페이지에 변경 내용과 시행일을 안내합니다. 본 방침의 시행일은 2026년 11월 2일입니다.</p> },
];

export default function PrivacyPage() {
  return <LegalDocument title="개인정보처리방침" summary="서비스 이용 과정에서 처리하는 정보와 저장 방식, 삭제 및 문의 방법을 안내합니다." sections={sections} related={{ href: '/terms', label: '이용약관 보기' }} />;
}
