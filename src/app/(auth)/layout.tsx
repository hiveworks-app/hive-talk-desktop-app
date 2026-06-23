export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="electron-safe-top flex min-h-full flex-col">
      {/* Electron(macOS): 헤더 없는 auth 화면을 위한 상단 드래그 핸들 (창 이동) */}
      <div className="electron-mac-drag-strip" aria-hidden />
      {children}
    </div>
  );
}
