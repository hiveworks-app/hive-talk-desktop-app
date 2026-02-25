export function DateSeparator({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr);
  const formatted = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  return (
    <div className="my-4 flex items-center gap-2">
      <div className="flex-1 border-t border-divider" />
      <span className="text-xs text-text-tertiary">{formatted}</span>
      <div className="flex-1 border-t border-divider" />
    </div>
  );
}
