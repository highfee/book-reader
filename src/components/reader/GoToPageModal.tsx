import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

interface GoToPageModalProps {
  visible: boolean;
  currentPage: number;
  totalPages: number;
  onClose: () => void;
  onJump: (pageNumber: number) => void;
}

const QUICK_STOPS: { label: string; fraction: number }[] = [
  { label: 'Start', fraction: 0 },
  { label: '25%', fraction: 0.25 },
  { label: 'Half', fraction: 0.5 },
  { label: '75%', fraction: 0.75 },
  { label: 'End', fraction: 1 },
];

function GoToSheet({ currentPage, totalPages, onClose, onJump }: Omit<GoToPageModalProps, 'visible'>) {
  const [draft, setDraft] = useState(String(currentPage));

  const parsed = parseInt(draft, 10);
  const isValid = Number.isFinite(parsed) && parsed >= 1 && parsed <= totalPages;
  const target = isValid ? parsed : currentPage;
  const percentOfBook = useMemo(
    () => Math.round((target / Math.max(1, totalPages)) * 100),
    [target, totalPages]
  );

  const jump = (page: number) => {
    onJump(Math.max(1, Math.min(page, totalPages)));
    onClose();
  };

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Go to Page</Text>
            <Text style={styles.subtitle}>
              Reading page {currentPage} of {totalPages}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={Math.max(3, String(totalPages).length)}
            autoFocus={true}
            returnKeyType="go"
            onSubmitEditing={() => {
              if (isValid) jump(parsed);
            }}
            style={[styles.input, !isValid && styles.inputInvalid]}
            placeholder="1"
            placeholderTextColor="#6B7280"
          />
          <View style={styles.inputMeta}>
            <Text style={styles.ofTotal}>of {totalPages}</Text>
            <Text style={styles.percent}>
              {isValid ? `${percentOfBook}% of book` : `Enter 1–${totalPages}`}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopsRow}>
          {QUICK_STOPS.map((stop) => {
            const page = Math.max(1, Math.round(1 + stop.fraction * (totalPages - 1)));
            return (
              <TouchableOpacity
                key={stop.label}
                style={styles.stopChip}
                onPress={() => jump(page)}
                activeOpacity={0.75}
              >
                <Text style={styles.stopLabel}>{stop.label}</Text>
                <Text style={styles.stopPage}>p. {page}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.goBtn, !isValid && styles.goBtnDisabled]}
            disabled={!isValid}
            onPress={() => jump(parsed)}
            activeOpacity={0.85}
          >
            <Text style={styles.goText}>{isValid ? `Go to ${parsed}` : 'Enter a page'}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  );
}

export const GoToPageModal: React.FC<GoToPageModalProps> = ({
  visible,
  currentPage,
  totalPages,
  onClose,
  onJump,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Mounting the sheet per open seeds the field with the current page without an effect. */}
      {visible ? (
        <GoToSheet currentPage={currentPage} totalPages={totalPages} onClose={onClose} onJump={onJump} />
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#16181D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerText: { flex: 1, minWidth: 0, paddingRight: 12 },
  title: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  closeBtn: { padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  input: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputInvalid: { borderColor: '#D84A6A' },
  inputMeta: { gap: 2 },
  ofTotal: { fontSize: 13, fontWeight: '700', color: '#E5E7EB' },
  percent: { fontSize: 11, color: '#9CA3AF' },
  stopsRow: { gap: 8, paddingBottom: 14 },
  stopChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 62,
  },
  stopLabel: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  stopPage: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  goBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#D84A6A',
    alignItems: 'center',
  },
  goBtnDisabled: { backgroundColor: '#3F3F46' },
  goText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
