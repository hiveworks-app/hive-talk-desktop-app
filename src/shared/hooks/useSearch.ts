import { useState, useCallback } from 'react';
import { filterByhangeulSearch } from '@/shared/utils/hangeulSearch';
import { useDebounce } from './useDebounce';

export interface UseSearchOptions {
  initialSearchValue?: string;
  resetOnClose?: boolean;
  debounceTime?: number;
}

export interface UseSearchReturn {
  isSearchVisible: boolean;
  displayValue: string;
  searchValue: string;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  handleChangeDisplayValue: (value: string) => void;
  handleSearch: (value: string) => void;
  filterItems: <T>(items: T[], getSearchText: (item: T) => string) => T[];
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { initialSearchValue = '', resetOnClose = true, debounceTime = 300 } = options;

  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(initialSearchValue);
  const [searchValue, setSearchValue] = useState(initialSearchValue);

  const debouncedSetSearchValue = useDebounce((value: string) => {
    setSearchValue(value);
  }, debounceTime);

  const openSearch = useCallback(() => {
    setIsSearchVisible(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchVisible(false);
    if (resetOnClose) {
      setDisplayValue('');
      setSearchValue('');
    }
  }, [resetOnClose]);

  const toggleSearch = useCallback(() => {
    setIsSearchVisible(prev => !prev);
    if (isSearchVisible && resetOnClose) {
      setDisplayValue('');
      setSearchValue('');
    }
  }, [isSearchVisible, resetOnClose]);

  const handleChangeDisplayValue = useCallback((value: string) => {
    setDisplayValue(value);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceTime === 0) {
        setSearchValue(value);
      } else {
        debouncedSetSearchValue(value);
      }
    },
    [debounceTime, debouncedSetSearchValue],
  );

  const filterItems = useCallback(
    <T>(items: T[], getSearchText: (item: T) => string): T[] => {
      return filterByhangeulSearch(items, searchValue, getSearchText);
    },
    [searchValue],
  );

  return {
    isSearchVisible,
    displayValue,
    searchValue,
    openSearch,
    closeSearch,
    toggleSearch,
    handleChangeDisplayValue,
    handleSearch,
    filterItems,
  };
}
