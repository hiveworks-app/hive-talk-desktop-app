export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="electron-safe-top flex min-h-full flex-col">{children}</div>;
}
