'use client';

interface SettingsOverlayProps {
  children: React.ReactNode;
  /** 배경색 유틸 클래스 (기본 bg-gray-50). */
  bg?: string;
}

/**
 * 설정 상세 화면용 전체창 오버레이.
 *
 * fixed inset-0 z-50으로 좌측 AppNav까지 덮어 풀스크린 포커스 화면을 만든다
 * (모바일의 풀스크린 push 대응). 상단 electron-drag 스트립은 오버레이가
 * macOS 신호등 영역을 가려도 창 드래그가 가능하도록 보존한다.
 */
export function SettingsOverlay({ children, bg = 'bg-gray-50' }: SettingsOverlayProps) {
  // electron-no-drag 루트는 정적으로 고정, 등장 애니메이션(transform)은 내부 래퍼에만 —
  // no-drag 루트가 움직이면 창 드래그 영역 구멍이 첫 프레임의 밀린 위치로 등록돼
  // 좌측 상단(뒤로가기 등) 클릭이 죽는다.
  return (
    <div className="electron-no-drag fixed inset-0 z-50">
      <div className={`animate-overlay-in flex h-full flex-col ${bg}`}>
        <div className="electron-drag h-8 w-full shrink-0" />
        {children}
      </div>
    </div>
  );
}
