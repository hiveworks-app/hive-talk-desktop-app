import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_RECENT = 10;

/**
 * 최근 사용 업무태그 스토어 (RN recent_tag_usage SQLite 패리티 — 데스크톱은 localStorage).
 * 태그 title 기준 최신순. 컨텍스트 메뉴 태그 빠른선택 슬롯의 소스.
 */
interface RecentTagUsageState {
  names: string[];
  record: (name: string) => void;
}

export const useRecentTagUsageStore = create<RecentTagUsageState>()(
  persist(
    set => ({
      names: [],
      record: name => {
        if (!name) return;
        set(state => ({
          names: [name, ...state.names.filter(n => n !== name)].slice(0, MAX_RECENT),
        }));
      },
    }),
    {
      name: 'recent-tag-usage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
