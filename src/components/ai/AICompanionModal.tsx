import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Sparkles, X, Send, ShieldCheck } from 'lucide-react-native';
import { GeminiAICompanionService, ChatMessage } from '@/services/ai/geminiProxy';
import { BookWithProgress } from '@/types/book';
import { TextExtractorService } from '@/services/parsers/textExtractor';

interface AICompanionModalProps {
  visible: boolean;
  book: BookWithProgress;
  currentPage: number;
  totalPages: number;
  onClose: () => void;
}

export const AICompanionModal: React.FC<AICompanionModalProps> = ({
  visible,
  book,
  currentPage,
  totalPages,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I'm your spoiler-safe reading companion for "${book.title}". I strictly only know what happens up to page ${currentPage}. Ask me anything!`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const extracted = await TextExtractorService.extractContextUpToPage(
        book.id,
        book.fileUri,
        book.format,
        currentPage,
        totalPages
      );

      const reply = await GeminiAICompanionService.sendChatMessage({
        bookTitle: book.title,
        author: book.author,
        currentPage,
        totalPages,
        extractedContextSoFar: extracted.textSoFar,
        userPrompt: text,
        history: messages,
      });

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I had trouble processing that request. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.sparkleIcon}>
                <Sparkles size={18} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.title}>AI Companion</Text>
                <View style={styles.spoilerBadge}>
                  <ShieldCheck size={12} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.spoilerBadgeText}>
                    Spoiler-safe up to page {currentPage}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Quick Action Chips */}
          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handleSendMessage('Give me a quick recap of the book so far')}
            >
              <Text style={styles.chipText}>📖 Recap so far</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handleSendMessage('Who are the main characters introduced so far?')}
            >
              <Text style={styles.chipText}>👥 Characters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handleSendMessage('What are the key themes explored so far?')}
            >
              <Text style={styles.chipText}>💡 Key Themes</Text>
            </TouchableOpacity>
          </View>

          {/* Message List */}
          <ScrollView
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
          >
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <View
                  key={m.id}
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.aiMessageText,
                    ]}
                  >
                    {m.text}
                  </Text>
                </View>
              );
            })}
            {loading && (
              <View style={[styles.messageBubble, styles.aiBubble]}>
                <ActivityIndicator size="small" color="#8B5CF6" />
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                isFocused && styles.inputFocused,
                Platform.select({
                  web: { outlineStyle: 'none' } as any,
                }),
              ]}
              placeholder="Ask about this book..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={() => handleSendMessage()}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                !inputText.trim() && styles.sendBtnDisabled,
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || loading}
            >
              <Send size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  spoilerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  spoilerBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#059669',
  },
  closeBtn: {
    padding: 6,
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  chatArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatContent: {
    paddingVertical: 12,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#F5F3FF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#1F2937',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputFocused: {
    borderColor: '#D97706',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.15)',
      } as any,
    }),
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
});
