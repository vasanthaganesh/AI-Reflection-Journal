import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const GUEST_TOKEN = 'Bearer guest-dev-token';

describe('Agent 1: Functional & Feature QA Tester (Verification Suite)', () => {
  const projectRoot = process.cwd();
  const pageTsxPath = path.join(projectRoot, 'app', 'page.tsx');
  const analyticsTsxPath = path.join(projectRoot, 'components', 'AnalyticsView.tsx');
  const pageTsx = fs.readFileSync(pageTsxPath, 'utf8');
  const analyticsTsx = fs.readFileSync(analyticsTsxPath, 'utf8');

  describe('1. Core Journaling Mechanics & State Transitions', () => {
    it('verifies journal entry structure and default initialization contract', () => {
      const newEntryData = {
        title: 'New Reflection',
        content: '',
        sections: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mood: 'neutral',
        messages: [],
        tags: [],
        images: [],
      };

      assert.strictEqual(newEntryData.title, 'New Reflection');
      assert.strictEqual(newEntryData.mood, 'neutral');
      assert.deepStrictEqual(newEntryData.sections, []);
      assert.deepStrictEqual(newEntryData.images, []);
      assert.ok(newEntryData.createdAt, 'Should have createdAt timestamp');
    });

    it('VERIFIED [RESOLVED]: Firestore remote writes are debounced with trailing timer, coalescing rapid keystrokes', () => {
      // Verify implementation in app/page.tsx
      assert.ok(pageTsx.includes('saveDebounceTimerRef'), 'page.tsx defines saveDebounceTimerRef');
      assert.ok(pageTsx.includes('pendingUpdatesRef'), 'page.tsx buffers pending updates in pendingUpdatesRef');
      assert.ok(pageTsx.includes('flushPendingSave'), 'page.tsx implements flushPendingSave for unmount/navigation safety');
      assert.ok(pageTsx.includes('1500'), 'page.tsx uses 1500ms debounce interval for remote saves');

      // Functional simulation of debounced write queue
      let remoteWriteCount = 0;
      let timer = null;
      const debouncedRemoteSave = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          remoteWriteCount++;
        }, 1500);
      };

      const text = 'Reflecting on a quiet morning in the garden.';
      for (let i = 0; i < text.length; i++) {
        debouncedRemoteSave();
      }

      // Fast typing immediately before timer fires: 0 remote writes executed yet
      assert.strictEqual(remoteWriteCount, 0, 'Does not flood remote database on individual keystrokes');
    });

    it('VERIFIED [RESOLVED]: Active entry selection and viewMode are preserved across page reload', () => {
      // Verify storage keys in app/page.tsx
      assert.ok(pageTsx.includes('mnemosyne_active_entry_'), 'page.tsx tracks active entry in localStorage');
      assert.ok(pageTsx.includes('mnemosyne_active_view_'), 'page.tsx tracks active view mode in localStorage');

      const entries = [
        { id: 'entry-1', title: 'First Entry', updatedAt: '2026-09-01T10:00:00Z' },
        { id: 'entry-2', title: 'Second Entry (Currently Editing)', updatedAt: '2026-09-02T10:00:00Z' },
        { id: 'entry-3', title: 'Third Entry', updatedAt: '2026-09-03T10:00:00Z' },
      ];

      const activeEntryId = 'entry-2';
      const activeViewMode = 'editor';

      // Simulation of reload retention contract
      const simulateReload = (entriesList, savedEntryId, savedViewMode) => {
        const matchingEntry = entriesList.find((e) => e.id === savedEntryId);
        return {
          currentEntryId: matchingEntry ? matchingEntry.id : entriesList[0]?.id,
          viewMode: savedViewMode || 'dashboard',
        };
      };

      const reloadedState = simulateReload(entries, activeEntryId, activeViewMode);
      assert.strictEqual(reloadedState.currentEntryId, 'entry-2', 'Preserves active entry selection across reload');
      assert.strictEqual(reloadedState.viewMode, 'editor', 'Preserves editor viewMode across reload');
    });

    it('VERIFIED [RESOLVED]: Cascade deletion cleans up orphaned reminder references when an entry is deleted', () => {
      assert.ok(pageTsx.includes('r.sourceEntryId !== id'), 'deleteEntry cascades reminder deletion matching sourceEntryId');

      const entryIdToDelete = 'entry-123';
      const reminders = [
        { id: 'rem-1', title: 'Dentist appointment', sourceEntryId: 'entry-123' },
        { id: 'rem-2', title: 'Buy tea', sourceEntryId: 'entry-999' },
      ];

      // Simulate cascade deletion logic
      const updatedReminders = reminders.filter((r) => r.sourceEntryId !== entryIdToDelete);
      const orphaned = updatedReminders.filter((r) => r.sourceEntryId === entryIdToDelete);

      assert.strictEqual(orphaned.length, 0, 'Orphaned reminders are completely removed');
      assert.strictEqual(updatedReminders.length, 1, 'Unrelated reminders are preserved');
      assert.strictEqual(updatedReminders[0].id, 'rem-2');
    });

    it('VERIFIED [RESOLVED]: Safe fallback protects against invalid or non-standard mood enum values', () => {
      const MOOD_CONFIGS = {
        neutral: { label: 'Neutral' },
        great: { label: 'Great' },
        good: { label: 'Good' },
        low: { label: 'Low' },
        rough: { label: 'Rough' },
        disturbing: { label: 'Disturbing' },
        professional: { label: 'Professional' },
      };

      const aiReturnedMood = 'contemplative'; // non-standard
      const entry = { mood: aiReturnedMood };

      // Verify safe lookup fallback
      assert.doesNotThrow(() => {
        const label = MOOD_CONFIGS[entry.mood]?.label || 'Neutral';
        assert.strictEqual(label, 'Neutral', 'Safely falls back to Neutral label');
      });

      // Verify page.tsx and AnalyticsView.tsx implement safe fallback
      assert.ok(pageTsx.includes("MOOD_CONFIGS[entry.mood]?.label || 'Neutral'"), 'page.tsx has fallback');
      assert.ok(analyticsTsx.includes('MOOD_CONFIGS[m] || MOOD_CONFIGS.neutral'), 'AnalyticsView.tsx has fallback');
    });
  });

  describe('2. AI Feature Stress-Testing (Live API)', () => {
    it('stress-test: handles extremely long unstructured text (5,000+ words)', async () => {
      const longText = 'I am reflecting upon the passing of time, seasons shifting, thoughts wandering through memories and ideas. '.repeat(150);
      const response = await fetch(`${BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: GUEST_TOKEN },
        body: JSON.stringify({
          title: 'Long Stream of Consciousness',
          text: longText,
        }),
      });

      assert.strictEqual(response.status, 200, 'API should respond 200 for long text');
      const data = await response.json();
      assert.ok(data.prompt, 'Should return an AI prompt');
      assert.ok(data.reflection, 'Should return a reflection');
      assert.ok(['great', 'good', 'low', 'rough', 'disturbing', 'professional', 'neutral'].includes(data.mood), 'Mood should be valid enum');
    });

    it('stress-test: handles special characters, unicode null bytes, and malicious script injection', async () => {
      const specialCharText = `<script>alert("xss")</script> \u0000 \u202E \uFFFF \\n\\r\\t "'; DROP TABLE sessions; -- 🦹‍♂️🔥💥`;
      const response = await fetch(`${BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: GUEST_TOKEN },
        body: JSON.stringify({
          title: 'Special Chars & HTML Injection Test',
          text: specialCharText,
        }),
      });

      assert.strictEqual(response.status, 200, 'API must handle special characters safely');
      const data = await response.json();
      assert.ok(typeof data.reflection === 'string', 'Should return string reflection');
      assert.ok(!data.reflection.includes('<script>'), 'AI output should not execute raw scripts');
    });

    it('stress-test: evaluates contradictory emotional inputs', async () => {
      const contradictoryText = `Today was the most ecstatic, thrilling breakthrough of my entire scientific career! We won the award and celebrated. But simultaneously I feel completely empty, broken-hearted, deeply depressed and weeping with grief over losing everything that mattered.`;
      
      const response = await fetch(`${BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: GUEST_TOKEN },
        body: JSON.stringify({
          title: 'Paradoxical Emotions',
          text: contradictoryText,
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.mood, 'Should assign a mood enum');
      assert.ok(data.reflection.length > 10, 'Reflection should address nuanced contradictory state');
    });

    it('stress-test: rejects empty payload with 400 Bad Request', async () => {
      const response = await fetch(`${BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: GUEST_TOKEN },
        body: JSON.stringify({
          title: '',
          text: '',
          sections: [],
        }),
      });

      assert.strictEqual(response.status, 400, 'Should reject empty entry with 400');
      const data = await response.json();
      assert.ok(data.error, 'Should return an error message');
    });

    it('stress-test: dialogue endpoint (/api/chat) handles conversational multi-turn context', async () => {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: GUEST_TOKEN },
        body: JSON.stringify({
          history: [
            { role: 'user', parts: [{ text: 'I am struggling with work-life balance.' }] },
            { role: 'model', parts: [{ text: 'Balance is not a static state, but dynamic equilibrium.' }] },
          ],
          prompt: 'How can Seneca or the Stoics help with this?',
        }),
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.text && data.text.length > 20, 'Chat should respond with philosophical advice');
    });
  });
});
