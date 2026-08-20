/**
 * 신고(Report) 카테고리 폴백 데이터
 * - 정본(SSOT)은 서버: GET /app/reports/categories (useGetReportCategories).
 * - 본 상수는 응답 도착 전·네트워크 실패 시에도 신고 화면이 비지 않도록 하는
 *   placeholder 로, Figma 정본 문구와 동일하다.
 * - code 는 신고 접수 API(POST /app/reports/messages) 의 reasonCategory 코드 체계
 *   (SPAM_AD | ABUSE | SEXUAL | FRAUD | ETC)와 동일하다.
 */
import type { ReportCategoriesPayload } from './type';

export const FALLBACK_REPORT_CATEGORIES: ReportCategoriesPayload = {
  categories: [
    {
      code: 'SPAM_AD',
      name: '스팸·광고',
      requiresDetail: false,
      descriptions: [
        '수신자의 동의 없이 전송된 영리목적의 광고성 정보 (스팸 메시지)',
        '음란·도박 사이트 등 불법 행위를 위한 광고성 정보 (불법 스팸 메시지)',
        '동일하거나 의미 없는 내용을 반복적으로 전송하는 행위',
        '외부 사이트·서비스로의 가입이나 이용을 유도하는 행위',
      ],
    },
    {
      code: 'ABUSE',
      name: '욕설·비하',
      requiresDetail: false,
      descriptions: [
        '욕설, 비속어를 사용한 메시지',
        '특정인을 비하하거나 모욕하는 메시지',
        '성별, 인종, 종교, 장애 등을 이유로 차별하는 메시지',
        '상대방을 지속적으로 비난하거나 위협하는 메시지',
      ],
    },
    {
      code: 'SEXUAL',
      name: '음란·성적 행위',
      requiresDetail: false,
      caution: '성범죄 피해를 입은 경우, 수사 기관에 피해 사실을 접수하세요.',
      descriptions: [
        '특정 성적 부위가 노출된 상태나 성적행위를 표현하거나 묘사하는 메시지',
        '음란물을 전송하거나 공유하는 행위',
        '성적 수치심을 유발하는 메시지',
        '성희롱에 해당하는 메시지',
      ],
    },
    {
      code: 'FRAUD',
      name: '사기·사칭',
      requiresDetail: false,
      caution: '금전 피해를 입은 경우, 수사 기관에 피해 사실을 접수하세요.',
      descriptions: [
        '타인의 이름, 직위 등을 사칭하는 행위',
        '금전 또는 송금을 유도하거나 개인정보를 요구하는 행위',
        '악성코드, 악성 앱 링크를 전송하여 피싱을 목적으로 하는 행위',
        '허위 정보를 유포하는 행위',
        '대금 편취 및 유사수신행위',
      ],
    },
    {
      // 기타: 정형 카테고리에 없는 위반. 사용자가 신고 내용을 직접 입력한다(requiresDetail).
      code: 'ETC',
      name: '기타',
      requiresDetail: true,
      descriptions: [
        '불쾌감을 주거나 부적절한 내용의 메시지',
        '업무 환경을 저해하는 메시지',
        '기타 서비스 이용에 방해가 되는 행위',
      ],
    },
  ],
  notice:
    '신고한 메시지는 하이브톡 운영팀으로 접수됩니다. 신고자 정보는 이력 관리 및 부정이용 탐지 목적으로 1년간 보관 후 파기됩니다. 허위 신고 시 서비스 이용이 제한될 수 있습니다.',
};

// 세부 화면 공통 안내 박스 문구 (모든 카테고리 동일 — Figma 정본)
export const REPORT_DETAIL_INFO_TEXT =
  '운영정책 위반 여부를 확인한 뒤, 위반 내용에 따라 신고된 사용자의 계정이 정지됩니다. 허위로 신고할 경우에도 서비스 이용이 제한될 수 있으니 유의해 주세요.';
