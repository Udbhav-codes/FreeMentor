/**
 * A YouTube video played inside the app, in YouTube's own embedded player.
 *
 * Rules this keeps (YouTube API Services Developer Policies, and the Required
 * Minimum Functionality for the embedded player):
 *   - YouTube's player, untouched: its controls, branding, links and its own
 *     ads are never hidden, covered or changed (III.F.1, III.I.4, III.I.5).
 *   - Nothing before the video but the play button: no ad, no paywall, no
 *     other action (III.F.3.2). billing/entitlement.ts never gates YouTube.
 *   - No autoplay; playback starts only when the learner presses play.
 *   - No background play: the video pauses when the app leaves the screen.
 *   - Never downloaded or cached for offline use (III.E.1).
 *   - The privacy-enhanced host (youtube-nocookie.com), so tracking stays off
 *     even for a video marked Made for Kids (III.E.4.j).
 *   - Full card width at 16:9, so it scales with the screen and never
 *     overflows (a phone card is ~330 dp wide, so ~185 dp tall; YouTube's own
 *     minimum for the embedded player is 200 x 200 px, which this clears).
 *
 * When a creator has turned embedding off, or the player cannot load, the
 * learner gets the old link instead (components/ResourceLink.tsx), which opens
 * the YouTube app. No error is shown; the link simply takes the player's place.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Resource } from '@freementor/shared';
import { ResourceLink } from './ResourceLink.tsx';
import { Pill, Txt } from './ui.tsx';
import { useT } from '../i18n/LanguageProvider.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';

/** The page the player is served from, so YouTube sees a real referrer. */
const ORIGIN = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://freementor.freementorteam.workers.dev')
  .replace(/\/+$/, '');

/** No ready signal within this long means the player is not coming. */
const LOAD_TIMEOUT_MS = 15_000;

/** The 11-character id from a resource, or null if it has none we trust. */
export function youtubeIdOf(resource: Resource): string | null {
  const candidates = [resource.youtube_id ?? null];
  try {
    const url = new URL(resource.url);
    candidates.push(url.searchParams.get('v'));
    if (url.hostname === 'youtu.be') candidates.push(url.pathname.slice(1));
    const embed = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/);
    if (embed) candidates.push(embed[1] ?? null);
  } catch {
    // Not a URL; only youtube_id can help.
  }
  return candidates.find((id): id is string => !!id && /^[A-Za-z0-9_-]{11}$/.test(id)) ?? null;
}

type VideoRole = 'main' | 'alternative' | 'extra';

const ROLE_LABEL = {
  main: 'day.videoMain',
  alternative: 'day.videoAlternative',
  extra: 'day.videoExtra',
} as const;

/** main, main_hi -> main; everything that is not extra is an alternative. */
export function roleOf(resource: Resource): VideoRole {
  const role = resource.role ?? 'main';
  if (role.startsWith('main')) return 'main';
  if (role === 'extra') return 'extra';
  return 'alternative';
}

function playerHtml(videoId: string): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}#p,iframe{position:absolute;inset:0;width:100%!important;height:100%!important;border:0}</style>
</head><body><div id="p"></div>
<script>
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
var player=null;
window.__pause=function(){try{player&&player.pauseVideo();}catch(e){}};
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{
    host:'https://www.youtube-nocookie.com',
    videoId:'${videoId}',
    // Without these the IFrame API draws a fixed 640 x 390 player, wider than
    // any phone, which is what pushed it out of the card.
    width:'100%',
    height:'100%',
    playerVars:{playsinline:1,rel:0,autoplay:0,origin:'${ORIGIN}'},
    events:{
      onReady:function(){post({type:'ready'});},
      onError:function(e){post({type:'error',code:String(e.data)});}
    }
  });
}
var s=document.createElement('script');
s.src='https://www.youtube.com/iframe_api';
s.onerror=function(){post({type:'error',code:'api_load'});};
document.head.appendChild(s);
</script></body></html>`;
}

export function YouTubeEmbed({ resource }: { resource: Resource }) {
  const theme = useTheme();
  const t = useT();
  const videoId = useMemo(() => youtubeIdOf(resource), [resource]);
  const [failed, setFailed] = useState(videoId === null);
  const [ready, setReady] = useState(false);
  const web = useRef<WebView>(null);

  // A player that never says it is ready is treated as a refusal.
  useEffect(() => {
    if (failed || ready) return;
    const timer = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [failed, ready]);

  // No background play: pause whenever the app is not in front.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') web.current?.injectJavaScript('window.__pause&&window.__pause();true;');
    });
    return () => sub.remove();
  }, []);

  // Pause on the way out too (closing the dropdown, leaving the day).
  useEffect(
    () => () => web.current?.injectJavaScript('window.__pause&&window.__pause();true;'),
    [],
  );

  if (failed || !videoId) return <ResourceLink resource={resource} />;

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string };
      if (message.type === 'ready') setReady(true);
      // 101 / 150 / 153: the creator does not allow embedding, or YouTube
      // refused the player. Any error at all falls back to the link.
      if (message.type === 'error') setFailed(true);
    } catch {
      // A message we did not send; ignore it.
    }
  };

  return (
    <View style={{ gap: theme.spacing.xs, alignSelf: 'stretch' }}>
      {/* What this video is, above it: the main one for the task, or an
          alternative to it (a different teacher, or Hindi). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Pill tone={roleOf(resource) === 'main' ? 'primary' : 'neutral'}>
          {t(ROLE_LABEL[roleOf(resource)])}
        </Pill>
        {resource.lang === 'hi' ? <Pill>हिंदी</Pill> : null}
      </View>
      <Txt variant="bodyStrong" numberOfLines={2}>
        {resource.title}
      </Txt>
      <View
        style={{
          // Width follows the card; height follows the width. No fixed size,
          // so nothing can push it past the card's edge.
          width: '100%',
          aspectRatio: 16 / 9,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        <WebView
          ref={web}
          source={{ html: playerHtml(videoId), baseUrl: ORIGIN }}
          originWhitelist={['*']}
          javaScriptEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          // No downloads, no offline copies (III.E.1).
          cacheEnabled={false}
          // The player's own links ("Watch on YouTube", the channel) must keep
          // working (III.I.4). They would replace the player page, so they
          // open in the YouTube app or browser instead.
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url;
            if (url.startsWith('about:') || url.startsWith(ORIGIN) || url.startsWith('data:')) {
              return true;
            }
            if (request.isTopFrame === false) return true;
            void Linking.openURL(url).catch(() => undefined);
            return false;
          }}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          style={{ backgroundColor: '#000' }}
        />
      </View>
      <Txt variant="caption" color="secondary" numberOfLines={2}>
        {resource.channel ?? resource.provider ?? ''}
      </Txt>
    </View>
  );
}
