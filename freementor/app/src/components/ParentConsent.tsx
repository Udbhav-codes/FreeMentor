/**
 * Verified parental consent for a 16- or 17-year-old — §15, DPDP Act 2023.
 *
 * Three states, in order: who to contact, the code they were sent, done.
 *
 * There is a fourth the app cannot avoid: no server. Nothing is deployed yet,
 * and the development sign-in bypass has no token, so verified consent is
 * simply unavailable on most builds today. Blocking onboarding on it would
 * brick the app for every tester, so that case falls back to the declaration
 * it had before — and says, in as many words, that a declaration is not the
 * parent's agreement.
 *
 * The code is never stored on the device. It is hashed server-side, salted
 * with the consent row's id, expires in 10 minutes and dies after five wrong
 * attempts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Card, Pill, Txt } from './ui.tsx';
import {
  CODE_LENGTH,
  RESEND_SECONDS,
  alreadyConsented,
  confirmParentCode,
  consentReachable,
  describeUnreachable,
  sendParentCode,
  type ConsentMethod,
} from '../api/consent.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

type Phase =
  /** Still working out whether a code can be sent at all. */
  | 'checking'
  | 'contact'
  | 'code'
  | 'verified'
  /** No server or no session — declaration only. */
  | 'unavailable';

export function ParentConsent({
  birthYear,
  onResolved,
}: {
  birthYear: number | null;
  /** 'verified' = the parent entered the code. 'declared' = the old path. */
  onResolved: (how: 'verified' | 'declared') => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>('checking');
  const [unreachable, setUnreachable] = useState<'not_configured' | 'no_session' | null>(null);

  const [contact, setContact] = useState('');
  const [method, setMethod] = useState<ConsentMethod>('email');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [declared, setDeclared] = useState(false);

  // Decide once, on mount, which path this build can take.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const reach = await consentReachable();
      if (!alive) return;
      if (!reach.usable) {
        setUnreachable(reach.reason);
        setPhase('unavailable');
        return;
      }
      // Already done on a previous install? Then do not ask again — asking
      // would replace a confirmed consent row with a fresh unconfirmed one.
      if (await alreadyConsented()) {
        if (!alive) return;
        setPhase('verified');
        onResolved('verified');
        return;
      }
      if (alive) setPhase('contact');
    })();
    return () => {
      alive = false;
    };
    // onResolved is stable in practice; re-running this would re-probe the
    // server on every parent keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown, mirroring the server's 60-second limit so the button is
  // disabled instead of earning a 429.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown]);

  const send = useCallback(async () => {
    if (birthYear == null) {
      setError('We need your birth year first.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await sendParentCode({ birthYear, parentContact: contact, method });
    setBusy(false);

    if (!result.ok) {
      setError(result.detail);
      if (result.tooSoon) setCooldown(RESEND_SECONDS);
      return;
    }
    setDemoCode(result.demoCode);
    setCooldown(RESEND_SECONDS);
    setPhase('code');
  }, [birthYear, contact, method]);

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await confirmParentCode(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setPhase('verified');
    onResolved('verified');
  }, [code, onResolved]);

  const field = [
    theme.typography.body,
    {
      marginTop: theme.spacing.sm,
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.text,
    },
  ];

  if (phase === 'checking') {
    return (
      <Card>
        <Txt variant="small" color="secondary">
          Checking…
        </Txt>
      </Card>
    );
  }

  if (phase === 'verified') {
    return (
      <Card>
        <Pill tone="success">Consent verified</Pill>
        <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          Your parent confirmed with the code we sent them. You will only ever see
          non-personalised, G-rated ads.
        </Txt>
      </Card>
    );
  }

  if (phase === 'unavailable') {
    return (
      <Card>
        <Txt variant="caption" color="secondary">
          PARENT&apos;S EMAIL OR PHONE
        </Txt>
        <TextInput
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="parent@example.com"
          placeholderTextColor={theme.colors.muted}
          style={field}
        />
        <Button
          label={declared ? 'Declared' : "I have my parent's permission"}
          variant={declared ? 'primary' : 'secondary'}
          onPress={() => {
            setDeclared(true);
            onResolved('declared');
          }}
          style={{ marginTop: theme.spacing.md }}
        />
        <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          This records what you told us, not your parent&apos;s agreement — a code sent
          to them is what verifies it.{' '}
          {unreachable ? describeUnreachable(unreachable) : ''} Either way you will only
          ever see non-personalised, G-rated ads.
        </Txt>
      </Card>
    );
  }

  if (phase === 'contact') {
    return (
      <Card>
        <Txt variant="caption" color="secondary">
          HOW SHOULD WE REACH THEM?
        </Txt>
        <View
          style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}
        >
          {(['email', 'sms'] as const).map((m) => (
            <Button
              key={m}
              compact
              label={m === 'email' ? 'Email' : 'SMS'}
              variant={method === m ? 'primary' : 'secondary'}
              onPress={() => setMethod(m)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <TextInput
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
          placeholder={method === 'email' ? 'parent@example.com' : '+91 98765 43210'}
          placeholderTextColor={theme.colors.muted}
          style={field}
        />

        {error ? (
          <Txt variant="small" color="danger" style={{ marginTop: theme.spacing.sm }}>
            {error}
          </Txt>
        ) : null}

        <Button
          label={busy ? 'Sending…' : 'Send them a code'}
          loading={busy}
          disabled={busy || contact.trim().length < 5 || cooldown > 0}
          onPress={() => void send()}
          style={{ marginTop: theme.spacing.md }}
        />
        <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          We send a {CODE_LENGTH}-digit code and store nothing else about them. It is
          valid for 10 minutes.
        </Txt>
      </Card>
    );
  }

  // phase === 'code'
  return (
    <Card>
      <Txt variant="caption" color="secondary">
        THE {CODE_LENGTH}-DIGIT CODE THEY RECEIVED
      </Txt>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        placeholder="123456"
        placeholderTextColor={theme.colors.muted}
        style={[...field, { letterSpacing: 6, textAlign: 'center' }]}
      />

      {demoCode ? (
        <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          {/* Only present while OTP_ECHO is on; production refuses to start
              with it enabled. It saves wiring an email provider to test. */}
          DEV: the code is {demoCode}
        </Txt>
      ) : null}

      {error ? (
        <Txt variant="small" color="danger" style={{ marginTop: theme.spacing.sm }}>
          {error}
        </Txt>
      ) : null}

      <Button
        label={busy ? 'Checking…' : 'Confirm'}
        loading={busy}
        disabled={busy || code.length !== CODE_LENGTH}
        onPress={() => void confirm()}
        style={{ marginTop: theme.spacing.md }}
      />
      <Button
        label={cooldown > 0 ? `Send again in ${cooldown}s` : 'Send another code'}
        variant="ghost"
        compact
        disabled={cooldown > 0 || busy}
        onPress={() => void send()}
      />
      <Button
        label="Change the contact"
        variant="ghost"
        compact
        onPress={() => {
          setPhase('contact');
          setCode('');
          setError(null);
        }}
      />
    </Card>
  );
}
