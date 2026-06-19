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
  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${bg}`}>
      <div className="electron-drag h-8 w-full shrink-0" />
      {children}
    </div>
  );
}
