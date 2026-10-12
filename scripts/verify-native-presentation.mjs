import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const appConfig = JSON.parse(read('app.json')).expo;
const fontPlugin = appConfig.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-font');
assert.ok(fontPlugin, 'expo-font must be configured for the Android APK.');

const fontFamily = fontPlugin[1]?.android?.fonts?.find(font => font.fontFamily === 'Vazirmatn');
assert.ok(fontFamily, 'Android must register Vazirmatn as a real font family.');
const weights = fontFamily.fontDefinitions.map(definition => definition.weight);
assert.deepEqual(weights, [400, 500, 600, 700, 800, 900], 'All text weights used by the app must have bundled Android faces.');
for (const definition of fontFamily.fontDefinitions) {
  assert.ok(existsSync(definition.path), `Bundled Android font is missing: ${definition.path}`);
}

const layout = read('app/_layout.tsx');
assert.match(layout, /useSafeAreaInsets/);
assert.match(layout, /insets\.top/);
assert.match(layout, /insets\.bottom/);
assert.match(layout, /\.\.\.LtrDirection/);
assert.doesNotMatch(layout, /I18nManager\.forceRTL\(true\)/);
assert.match(layout, /useFonts\(FONT_SOURCES\)/);
assert.match(read('components/ErrorBoundary.tsx'), /SafeAreaView style=\{styles\.screen\} edges=\{\['top', 'bottom'\]\}/);
for (const path of [
  'app/course/lesson.tsx',
  'components/RussianLesson.tsx',
  'app/permissions.tsx',
  'app/conversations/index.tsx',
  'app/conversations/emma.tsx',
  'app/conversations/invite.tsx',
  'app/conversations/human/[conversationId].tsx',
]) {
  assert.match(read(path), /Platform\.OS === 'web' \? (?:42|50|52|56) : (?:14|26|28|32)/, `${path} must not apply a second fixed status-bar inset on Android.`);
}
const androidFontSources = read('lib/fontSources.android.ts');
assert.match(androidFontSources, /FONT_SOURCES: Record<string, FontSource> = \{\}/, 'Android must not bundle a second runtime copy of its native fonts.');
const runtimeFontSources = read('lib/fontSources.ts');
assert.match(runtimeFontSources, /'Vazirmatn-ExtraBold'/);
assert.match(runtimeFontSources, /'Vazirmatn-Black'/);

const entry = read('index.js');
assert.match(entry, /I18nManager\.forceRTL\(false\)/, 'Reset the old global forced-RTL setting.');
assert.match(entry, /I18nManager\.swapLeftAndRightInRTL\(false\)/, 'Physical icon offsets must not be mirrored globally.');

const appText = read('components/AppText.tsx');
assert.match(appText, /Platform\.OS === 'android' \? \{ includeFontPadding: false \} : \{\}/);
assert.match(appText, /ANDROID_MIN_FONT_SIZE = 12/);
assert.match(appText, /Math\.ceil\(fontSize \* 1\.3\)/, 'Short Android line-heights must not clip Persian glyphs.');
assert.match(appText, /writingDirection: direction/);
assert.match(appText, /Vazirmatn-ExtraBold/);
assert.match(appText, /TextInput/);

const landing = read('app/languages.tsx');
assert.match(landing, /const singleColumnCards = waitingForWebLayout \|\| width < 340/);
assert.match(landing, /const stackHero = waitingForWebLayout \|\| width < 350/);
assert.match(landing, /compact && !singleColumnCards && styles\.cardsPhone/);
assert.match(landing, /cardsPhone: \{ gap: 10 \}/, 'The initial language choices must remain side-by-side on common phone widths.');

const uiFiles = [...walk('app'), ...walk('components')]
  .filter(path => path.endsWith('.tsx') && path !== 'components/AppText.tsx');
const nativeTextImports = uiFiles.filter(path => /import\s*\{[^}]*\b(?:Text|TextInput)\b[^}]*\}\s*from\s*['"]react-native['"]/s.test(read(path)));
assert.deepEqual(nativeTextImports, [], `Use AppText for reliable native text: ${nativeTextImports.join(', ')}`);
const appTextImports = uiFiles.filter(path => /from\s*['"]@\/components\/AppText['"]/.test(read(path)));
assert.ok(appTextImports.length >= 45, 'App screens and inputs should use the shared font-aware text components.');

const russianHome = read('components/RussianHome.tsx');
assert.doesNotMatch(russianHome, /flexDirection: 'row',/, 'Russian home rows should not depend on ambient RTL layout.');
assert.match(read('components/RussianBottomNav.tsx'), /flexDirection: 'row-reverse'/);
assert.match(read('components/EnglishUI.tsx'), /progressFill: \{[^}]*alignSelf: 'flex-end'/);

console.log(`Native presentation checks passed: ${weights.length} Android font faces, safe areas, explicit layout direction, responsive two-column landing page, readable text wrapper, and ${appTextImports.length} shared-text screens/components.`);

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}
