/**
 * A confirmation card for the actions that are hard to undo: sign out, reset
 * the roadmap, delete the account.
 *
 * A system Alert reads as a generic popup and is easy to tap through. This is
 * a card in the app's own style, and for the worst cases (`typeToConfirm`) the
 * learner must type a phrase before the button wakes up, so an account cannot
 * be deleted by a stray double tap.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { Button, Card, Txt } from './ui.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { useT } from '../i18n/LanguageProvider.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';
import { matchesPhrase } from '../profile/confirmPhrase.ts';


export function ConfirmCard({
  visible,
  title,
  body,
  confirmLabel,
  destructive = false,
  typeToConfirm,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  /** When set, the learner must type this phrase before confirming. */
  typeToConfirm?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const [typed, setTyped] = useState('');

  // A fresh card every time it opens: a phrase typed last time must not count.
  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  const ready = !busy && (typeToConfirm ? matchesPhrase(typed, typeToConfirm) : true);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityLabel={t('common.cancel')}
          onPress={busy ? undefined : onCancel}
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: theme.spacing.screen,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        >
          {/* Taps on the card itself must not fall through to the backdrop. */}
          <Pressable onPress={() => undefined}>
            <Card style={{ gap: theme.spacing.md }}>
              <Txt variant="heading">{title}</Txt>
              <Txt variant="body" color="secondary">
                {body}
              </Txt>

              {typeToConfirm ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <Txt variant="small">
                    {t('confirm.typeToConfirm', { phrase: typeToConfirm })}
                  </Txt>
                  <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    placeholder={typeToConfirm}
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t('confirm.typeToConfirm', { phrase: typeToConfirm })}
                    style={[
                      theme.typography.body,
                      {
                        minHeight: MIN_TOUCH_TARGET,
                        paddingHorizontal: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text,
                      },
                    ]}
                  />
                </View>
              ) : null}

              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                <Button
                  label={confirmLabel}
                  loading={busy}
                  disabled={!ready}
                  onPress={onConfirm}
                  style={
                    destructive && ready ? { backgroundColor: theme.colors.danger } : undefined
                  }
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  disabled={busy}
                  onPress={onCancel}
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
