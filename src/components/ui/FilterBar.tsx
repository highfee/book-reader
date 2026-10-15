import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Search, X, LayoutGrid, List } from 'lucide-react-native';
import { ReadingStatus } from '@/types/book';
import { HorizontalScroll } from './HorizontalScroll';

interface FilterBarProps {
  status: 'all' | ReadingStatus;
  searchQuery: string;
  onStatusChange: (status: 'all' | ReadingStatus) => void;
  onSearchChange: (query: string) => void;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  status,
  searchQuery,
  onStatusChange,
  onSearchChange,
  viewMode = 'grid',
  onViewModeChange,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const tabs: { label: string; value: 'all' | ReadingStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Reading', value: 'reading' },
    { label: 'Unread', value: 'unread' },
    { label: 'Finished', value: 'finished' },
  ];

  return (
    <View style={styles.container}>
      {/* Search Input Row with View Mode Switcher */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
          <Search size={16} color={isFocused ? '#B45309' : '#A8A29E'} style={styles.searchIcon} />
          <TextInput
            placeholder="Search titles, authors, genres..."
            placeholderTextColor="#A8A29E"
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={[
              styles.input,
              Platform.select({
                web: { outlineStyle: 'none' } as any,
              }),
            ]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearBtn}>
              <X size={15} color="#A8A29E" />
            </TouchableOpacity>
          )}
        </View>

        {/* View Mode Switcher (Grid vs List) */}
        {onViewModeChange && (
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                viewMode === 'grid' && styles.modeBtnActive,
              ]}
              onPress={() => onViewModeChange('grid')}
              activeOpacity={0.7}
              accessibilityLabel="Grid View"
            >
              <LayoutGrid
                size={16}
                color={viewMode === 'grid' ? '#1C1917' : '#A8A29E'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeBtn,
                viewMode === 'list' && styles.modeBtnActive,
              ]}
              onPress={() => onViewModeChange('list')}
              activeOpacity={0.7}
              accessibilityLabel="List View"
            >
              <List
                size={16}
                color={viewMode === 'list' ? '#1C1917' : '#A8A29E'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Status Filter Tabs (Scrollable) */}
      <HorizontalScroll
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {tabs.map((tab) => {
          const isActive = status === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => onStatusChange(tab.value)}
              style={[styles.chip, isActive && styles.activeChip]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.activeChipText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </HorizontalScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: '#0D0E11',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181D',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchBoxFocused: {
    borderColor: '#D84A6A',
    backgroundColor: '#16181D',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#16181D',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
  },
  modeBtnActive: {
    backgroundColor: '#1F222A',
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activeChipText: {
    color: '#0D0E11',
    fontWeight: '800',
  },
});
