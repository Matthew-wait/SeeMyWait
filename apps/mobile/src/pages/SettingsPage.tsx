/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomNav } from '@/src/components/navigation/BottomNav';
import { useTheme } from '@/src/hooks/use-theme';
import { getDeviceFingerprint } from '@/src/lib/device-fingerprint';
import { safeGetItem, safeSetItem } from '@/src/lib/safe-storage';
import { supabase } from '@/src/lib/supabase';
import { showToast } from '@/src/lib/toast';
import {
  registerForPushNotificationsAsync,
  savePushToken,
  deletePushToken,
} from '@/src/lib/notifications';

const KEY_NOTIFICATIONS = 'settings_notifications';
const SWITCH_TRACK_ON = '#34c3ff';
const SWITCH_TRACK_OFF_DARK = '#51627c';
const SWITCH_TRACK_OFF_LIGHT = '#cbd5e1';
const SWITCH_THUMB_ON_DARK = '#081a3a';
const SWITCH_THUMB_OFF_DARK = '#06122c';
const SWITCH_THUMB_LIGHT = '#ffffff';

export const SettingsPage = () => {
  const { isDark, toggleTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      const notif = await safeGetItem(KEY_NOTIFICATIONS);
      const isEnabled = notif ? notif === 'true' : true;
      setNotificationsEnabled(isEnabled);
      if (isEnabled) {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await savePushToken(token);
          }
        } catch (err) {
          console.warn('Background push registration failed:', err);
        }
      }
    };
    void load();
  }, []);

  const toggleNotifications = async () => {
    const next = !notificationsEnabled;
    
    if (next) {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushToken(token);
          setNotificationsEnabled(true);
          await safeSetItem(KEY_NOTIFICATIONS, 'true');
          showToast('Notifications enabled successfully.');
        } else {
          showToast('Permission denied or push not supported.');
        }
      } catch (err) {
        console.error('Failed to enable push notifications:', err);
        showToast('Failed to enable push notifications.');
      }
    } else {
      try {
        await deletePushToken();
        setNotificationsEnabled(false);
        await safeSetItem(KEY_NOTIFICATIONS, 'false');
        showToast('Notifications disabled.');
      } catch (err) {
        console.error('Failed to disable push notifications:', err);
        showToast('Failed to disable push notifications.');
      }
    }
  };

  const sendFeedback = async () => {
    if (!feedbackMessage.trim()) {
      showToast('Feedback message is required.');
      return;
    }
    setSending(true);
    try {
      const fingerprint = await getDeviceFingerprint();
      const { error } = await supabase.from('feedback_submissions').insert({
        email: feedbackEmail.trim() || null,
        message: feedbackMessage.trim(),
        device_fingerprint: fingerprint,
        page: 'settings',
      });
      if (error) throw error;

      supabase.functions
        .invoke('send-email', {
          body: {
            action: 'feedback_admin_notification',
            email: feedbackEmail.trim() || null,
            message: feedbackMessage.trim(),
          },
        })
        .catch((emailError) => {
          console.error('feedback admin email failed', emailError);
        });

      if (feedbackEmail.trim()) {
        supabase.functions
          .invoke('send-email', {
            body: {
              action: 'feedback_thank_you',
              to: feedbackEmail.trim(),
            },
          })
          .catch((emailError) => {
            console.error('feedback thank-you email failed', emailError);
          });
      }

      showToast('Feedback sent. Thank you!');
      setFeedbackOpen(false);
      setFeedbackEmail('');
      setFeedbackMessage('');
    } catch (error) {
      const code = (error as { code?: string }).code;
      const rawMessage = (error as { message?: string }).message;
      if (code === '42P01') {
        showToast('Feedback storage is not set up yet. Please run latest migration.');
      } else {
        showToast(rawMessage?.trim() ? rawMessage : 'Failed to send feedback.');
      }
      console.error('feedback submit error', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#0b1220' : '#e5e7eb' }]}>
      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: isDark ? '#0b1220' : '#e5e7eb' }]}>
        <View style={[styles.header, { backgroundColor: isDark ? '#0f1c34' : '#0284c7' }]}>
          <View style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={18} color="#fff" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Personalize your experience</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                isDark && { backgroundColor: '#0f2a44', borderColor: '#1e3a5f', borderWidth: 1 },
              ]}>
              <Ionicons name="sparkles-outline" size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f1f5f9' : '#111827' }]}>Appearance</Text>
          </View>
          <View style={styles.settingRow}>
            <View
              style={[
                styles.settingIcon,
                isDark && { backgroundColor: '#0f2a44', borderColor: '#1e3a5f', borderWidth: 1 },
              ]}>
              <Ionicons name="sunny-outline" size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.label, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Dark Mode</Text>
              <Text style={[styles.helpText, { color: isDark ? '#94a3b8' : '#475569' }]}>
                Currently using {isDark ? 'dark' : 'light'} theme
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => void toggleTheme()}
              trackColor={{ false: isDark ? SWITCH_TRACK_OFF_DARK : SWITCH_TRACK_OFF_LIGHT, true: SWITCH_TRACK_ON }}
              thumbColor={isDark ? SWITCH_THUMB_ON_DARK : SWITCH_THUMB_LIGHT}
              ios_backgroundColor={isDark ? SWITCH_TRACK_OFF_DARK : SWITCH_TRACK_OFF_LIGHT}
            />
          </View>
        </View>

        {/* 
        <View style={[styles.section, { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                isDark && { backgroundColor: '#0f2a44', borderColor: '#1e3a5f', borderWidth: 1 },
              ]}>
              <Ionicons name="notifications-outline" size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f1f5f9' : '#111827' }]}>Notifications</Text>
          </View>
          <View style={styles.settingRow}>
            <View
              style={[
                styles.settingIcon,
                isDark && { backgroundColor: '#0f2a44', borderColor: '#1e3a5f', borderWidth: 1 },
              ]}>
              <Ionicons name="notifications-outline" size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.label, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Push Notifications</Text>
              <Text style={[styles.helpText, { color: isDark ? '#94a3b8' : '#475569' }]}>Get alerts for wait time updates</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={() => void toggleNotifications()}
              trackColor={{ false: isDark ? SWITCH_TRACK_OFF_DARK : SWITCH_TRACK_OFF_LIGHT, true: SWITCH_TRACK_ON }}
              thumbColor={isDark ? (notificationsEnabled ? SWITCH_THUMB_ON_DARK : SWITCH_THUMB_OFF_DARK) : SWITCH_THUMB_LIGHT}
              ios_backgroundColor={isDark ? SWITCH_TRACK_OFF_DARK : SWITCH_TRACK_OFF_LIGHT}
            />
          </View>
        </View>
        */}

        <View style={[styles.section, { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                isDark && { backgroundColor: '#0f2a44', borderColor: '#1e3a5f', borderWidth: 1 },
              ]}>
              <Ionicons name="globe-outline" size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f1f5f9' : '#111827' }]}>Contact</Text>
          </View>
          <Pressable style={styles.feedbackRow} onPress={() => setFeedbackOpen(true)}>
            <View
              style={[
                styles.settingIcon,
                isDark && { backgroundColor: '#0f2a44', borderColor: '#1e3a5f', borderWidth: 1 },
              ]}>
              <Ionicons name="chatbubble-outline" size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.label, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Send Feedback</Text>
              <Text style={[styles.helpText, { color: isDark ? '#94a3b8' : '#475569' }]}>Help us improve the app</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#64748b" />
          </Pressable>
        </View>
        <View style={[styles.aboutCard, { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <Text style={[styles.aboutText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
              <Text style={[styles.aboutTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>SeeMyWait</Text> helps patients find real-time wait times at doctor&apos;s
              offices. Reports are anonymous and voluntary.
            </Text>
          <View style={styles.versionRow}>
            <Feather name="heart" size={12} color="#0ea5e9" />
            <Text style={[styles.versionText, { color: isDark ? '#94a3b8' : '#334155' }]}>Version 1.0.0 - Made with love</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={feedbackOpen} transparent animationType="slide" onRequestClose={() => setFeedbackOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#172033' : 'white' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Send Feedback</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' }]}
              placeholder="Email (optional)"
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
              value={feedbackEmail}
              onChangeText={setFeedbackEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' },
              ]}
              placeholder="Your message"
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setFeedbackOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sendBtn, { backgroundColor: isDark ? '#38bdf8' : '#0284c7' }]}
                onPress={() => void sendFeedback()}
                disabled={sending}>
                <Text style={styles.sendBtnText}>{sending ? 'Sending...' : 'Send'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 18,
    backgroundColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0284c7',
    paddingTop: 42,
    paddingHorizontal: 14,
    paddingBottom: 34,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  headerTextWrap: {
    marginTop: 6,
  },
  headerSubtitle: {
    color: '#e0f2fe',
    fontSize: 12,
  },
  section: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginTop: 10,
    marginHorizontal: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextWrap: {
    flex: 1,
  },
  label: {
    color: '#0f172a',
    fontWeight: '600',
  },
  helpText: {
    color: '#475569',
    fontSize: 11,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    gap: 6,
    marginTop: 10,
    marginHorizontal: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  aboutTitle: {
    fontWeight: '700',
    color: '#0f172a',
  },
  aboutText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  versionRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  versionText: {
    color: '#334155',
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
  },
  sendBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtnText: {
    color: 'white',
    fontWeight: '700',
  },
});
