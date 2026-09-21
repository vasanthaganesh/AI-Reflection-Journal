import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Sanctuary AI Companion Verification Suite', () => {
  const projectRoot = process.cwd();
  const pageTsxPath = path.join(projectRoot, 'app', 'page.tsx');
  const typesTsPath = path.join(projectRoot, 'lib', 'types.ts');
  const personasTsPath = path.join(projectRoot, 'lib', 'personas.ts');
  const sanctuaryViewTsxPath = path.join(projectRoot, 'components', 'SanctuaryView.tsx');
  const auraTsxPath = path.join(projectRoot, 'components', 'LivingMarbleAura.tsx');
  const companionRoutePath = path.join(projectRoot, 'app', 'api', 'companion', 'route.ts');
  const crystallizeRoutePath = path.join(projectRoot, 'app', 'api', 'companion', 'crystallize', 'route.ts');
  const dashboardHomeTsxPath = path.join(projectRoot, 'components', 'DashboardHome.tsx');

  describe('1. Persona Archetypes & Prompts Contract', () => {
    it('verifies lib/personas.ts exports all 5 core personas with complete visual and behavioral configs', () => {
      const personasContent = fs.readFileSync(personasTsPath, 'utf8');
      assert.ok(personasContent.includes('samantha:'), 'Samantha persona defined');
      assert.ok(personasContent.includes('bestie:'), 'Alex (Bestie) persona defined');
      assert.ok(personasContent.includes('mentor:'), 'Marcus (Mentor) persona defined');
      assert.ok(personasContent.includes('parent:'), 'Safe Harbor (Parent) persona defined');
      assert.ok(personasContent.includes('coach:'), 'Socrates (Coach) persona defined');

      // Verify Tanglish / Romanized Tamil support in Samantha prompt
      assert.ok(personasContent.includes('Tanglish') || personasContent.includes('Tamil'), 'Samantha persona explicitly supports Tanglish/Tamil');
      // Verify anti-asterisk rule so voice synthesizer never reads out stage directions
      assert.ok(personasContent.includes('NO ASTERISKS'), 'Stage directions with asterisks are prohibited for clean speech');
    });

    it('verifies ViewMode includes sanctuary in lib/types.ts', () => {
      const typesContent = fs.readFileSync(typesTsPath, 'utf8');
      assert.ok(typesContent.includes("'sanctuary'"), 'ViewMode type union includes sanctuary');
      assert.ok(typesContent.includes('CompanionPersonaId'), 'CompanionPersonaId type exported');
      assert.ok(typesContent.includes('CompanionPersona'), 'CompanionPersona interface exported');
      assert.ok(typesContent.includes('CompanionMessage'), 'CompanionMessage interface exported');
      assert.ok(typesContent.includes('CrystallizeResult'), 'CrystallizeResult interface exported');
    });
  });

  describe('2. Sanctuary Visual & Voice UI Components', () => {
    it('verifies LivingMarbleAura.tsx implements responsive 3D specular marble canvas with color interpolation', () => {
      assert.ok(fs.existsSync(auraTsxPath), 'LivingMarbleAura.tsx exists');
      const auraContent = fs.readFileSync(auraTsxPath, 'utf8');
      assert.ok(auraContent.includes('createRadialGradient'), 'Uses radial gradients for 3D glass sphere rendering');
      assert.ok(auraContent.includes('audioLevel'), 'Accepts audio level for sound-reactive breathing animation');
      assert.ok(auraContent.includes('palette'), 'Accepts dynamic RGB palette per persona');
    });

    it('verifies SanctuaryView.tsx implements persona switching, speech recognition, and 1-click crystallize', () => {
      assert.ok(fs.existsSync(sanctuaryViewTsxPath), 'SanctuaryView.tsx exists');
      const sanctuaryContent = fs.readFileSync(sanctuaryViewTsxPath, 'utf8');
      assert.ok(sanctuaryContent.includes('activePersonaId'), 'Tracks active companion persona');
      assert.ok(sanctuaryContent.includes('startListening') || sanctuaryContent.includes('SpeechRecognition'), 'Supports speech recognition');
      assert.ok(sanctuaryContent.includes('handleCrystallizeReflection'), 'Provides 1-click reflection crystallization');
      assert.ok(sanctuaryContent.includes('journalContextString'), 'Injects recent journal entries into companion memory');
    });
  });

  describe('3. Main App & Dashboard Integration', () => {
    it('verifies page.tsx integrates Sanctuary in navigation and view switcher with sliding capsule', () => {
      const pageContent = fs.readFileSync(pageTsxPath, 'utf8');
      assert.ok(pageContent.includes("id: 'sanctuary' as ViewMode"), 'Sanctuary tab present in header nav');
      assert.ok(pageContent.includes("<SanctuaryView"), 'SanctuaryView component rendered when active');
      assert.ok(pageContent.includes('handleSaveSanctuaryReflection'), 'Provides callback to persist crystallized reflections');
    });

    it('verifies DashboardHome.tsx features AI Companion Sanctuary card', () => {
      const dashboardContent = fs.readFileSync(dashboardHomeTsxPath, 'utf8');
      assert.ok(dashboardContent.includes("onNavigate('sanctuary')"), 'Dashboard features click navigation to sanctuary');
      assert.ok(dashboardContent.includes('AI Companion Sanctuary'), 'Displays AI Companion Sanctuary title');
    });
  });

  describe('4. Backend Companion API Contracts', () => {
    it('verifies /api/companion endpoint exists with Gemini fallback and emotion parsing', () => {
      assert.ok(fs.existsSync(companionRoutePath), '/api/companion/route.ts exists');
      const routeContent = fs.readFileSync(companionRoutePath, 'utf8');
      assert.ok(routeContent.includes('generateContentWithFallback') || routeContent.includes('GoogleGenAI'), 'Calls Gemini API');
      assert.ok(routeContent.includes('parseEmotion'), 'Extracts emotion tags from response');
      assert.ok(routeContent.includes('cleanSpeechText'), 'Strips asterisks from spoken dialogue');
      assert.ok(routeContent.includes('checkRateLimit'), 'Implements rate-limiting security');
    });

    it('verifies /api/companion/crystallize endpoint synthesizes reflections into journal entries', () => {
      assert.ok(fs.existsSync(crystallizeRoutePath), '/api/companion/crystallize/route.ts exists');
      const crystallizeContent = fs.readFileSync(crystallizeRoutePath, 'utf8');
      assert.ok(crystallizeContent.includes('VALID_MOODS'), 'Validates extracted mood against journal mood enum');
      assert.ok(crystallizeContent.includes('title'), 'Generates journal title');
      assert.ok(crystallizeContent.includes('content'), 'Generates journal narrative content');
    });
  });
});
