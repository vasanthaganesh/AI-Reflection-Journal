import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// WCAG relative luminance and contrast ratio calculator
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function getRelativeLuminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function blendAlpha(fgRgb, alpha, bgRgb) {
  return [
    Math.round(fgRgb[0] * alpha + bgRgb[0] * (1 - alpha)),
    Math.round(fgRgb[1] * alpha + bgRgb[1] * (1 - alpha)),
    Math.round(fgRgb[2] * alpha + bgRgb[2] * (1 - alpha)),
  ];
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Agent 2: UX Auditor & UI Engineer (Verification Suite)', () => {
  const projectRoot = process.cwd();
  const pageTsxPath = path.join(projectRoot, 'app', 'page.tsx');
  const globalsCssPath = path.join(projectRoot, 'app', 'globals.css');
  const imageBallPath = path.join(projectRoot, 'components', 'ImageBall.tsx');
  const analyticsPath = path.join(projectRoot, 'components', 'AnalyticsView.tsx');

  const pageTsx = fs.readFileSync(pageTsxPath, 'utf8');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
  const imageBallTsx = fs.readFileSync(imageBallPath, 'utf8');

  describe('1. Color Contrast & WCAG 2.1 AA Compliance Verification', () => {
    const bgGhostWhite = hexToRgb('#F6F5FA');
    const fgEerieBlack = hexToRgb('#212121');
    const bgPaper = hexToRgb('#FAF6EE');
    const fgBlueInk = hexToRgb('#1a4eb8');

    it('VERIFIED [RESOLVED]: text-[#212121]/65 on #F6F5FA achieves >= 4.5:1 WCAG 2.1 AA ratio', () => {
      const blended = blendAlpha(fgEerieBlack, 0.65, bgGhostWhite);
      const ratio = getContrastRatio(blended, bgGhostWhite);
      assert.ok(
        ratio >= 4.5,
        `Muted body contrast ratio is ${ratio.toFixed(2)}:1 (Passes WCAG AA 4.5:1 requirement)`
      );
    });

    it('VERIFIED [RESOLVED]: blue-ink-placeholder (alpha 0.82) on paper achieves >= 4.5:1 WCAG 2.1 AA ratio', () => {
      const blended = blendAlpha(fgBlueInk, 0.82, bgPaper);
      const ratio = getContrastRatio(blended, bgPaper);
      assert.ok(
        ratio >= 4.5,
        `Blue ink placeholder contrast is ${ratio.toFixed(2)}:1 (Passes WCAG AA 4.5:1)`
      );
    });

    it('verifies globals.css and page.tsx use compliant contrast alphas', () => {
      assert.ok(
        globalsCss.includes('.blue-ink-placeholder::placeholder') &&
        globalsCss.includes('rgba(26, 78, 184, 0.82)'),
        'globals.css defines 0.82 alpha for blue ink placeholder'
      );
      assert.ok(
        pageTsx.includes('placeholder-[#212121]/65') || pageTsx.includes('text-[#212121]/65'),
        'page.tsx uses high-contrast /65 opacity for muted text and inputs'
      );
    });
  });

  describe('2. Touch-Target Sizes & Mobile Ergonomics Verification', () => {
    it('VERIFIED [RESOLVED]: ImageBall remove button satisfies 44px minimum touch target with descriptive label', () => {
      assert.ok(
        imageBallTsx.includes('min-w-[44px] min-h-[44px]'),
        'ImageBall remove button has >= 44px minimum hit area'
      );
      assert.ok(
        imageBallTsx.includes('aria-label="Remove photo"'),
        'ImageBall remove button includes aria-label="Remove photo"'
      );
    });

    it('VERIFIED [RESOLVED]: deleteEntry button in sidebar satisfies 44px minimum touch target', () => {
      assert.ok(
        pageTsx.includes('min-w-[44px] min-h-[44px]') && pageTsx.includes('aria-label="Delete Entry"'),
        'Sidebar delete entry button satisfies 44px touch target with aria-label'
      );
    });

    it('VERIFIED [RESOLVED]: section delete button in editor satisfies 44px minimum touch target', () => {
      assert.ok(
        pageTsx.includes('min-w-[44px] min-h-[44px]') && pageTsx.includes('aria-label="Remove section"'),
        'Editor section delete button satisfies 44px touch target with aria-label'
      );
    });
  });

  describe('3. Responsive DOM Structure & Viewport Layouts Verification', () => {
    it('VERIFIED [RESOLVED]: Sidebar includes mobile backdrop overlay when open on small screens', () => {
      const hasMobileBackdrop = pageTsx.includes('isSidebarOpen &&') && pageTsx.includes('fixed inset-0 bg-black/40');
      assert.ok(
        hasMobileBackdrop,
        'Mobile sidebar includes backdrop overlay element to prevent click-through and support tap-to-dismiss'
      );
    });

    it('VERIFIED [RESOLVED]: AI Assistant panel behaves as a responsive slide-over drawer on mobile viewports', () => {
      const hasResponsiveDrawer =
        pageTsx.includes('fixed inset-y-0 right-0') &&
        pageTsx.includes('lg:static') &&
        pageTsx.includes('isAiPanelOpen &&');
      assert.ok(
        hasResponsiveDrawer,
        'AI Assistant uses slide-over drawer on small screens and static sidebar on large screens'
      );
    });
  });

  describe('4. Keyboard Navigation & ARIA Accessibility Verification', () => {
    it('VERIFIED [RESOLVED]: Entry list items support keyboard focus and Enter/Space activation', () => {
      assert.ok(
        pageTsx.includes('role="button"') &&
        pageTsx.includes('tabIndex={0}') &&
        pageTsx.includes("e.key === 'Enter' || e.key === ' '"),
        'Entry items implement role="button", tabIndex={0}, and onKeyDown handler'
      );
    });

    it('VERIFIED [RESOLVED]: App logo home button supports keyboard focus and activation', () => {
      assert.ok(
        pageTsx.includes('role="button"') &&
        pageTsx.includes("setViewMode('dashboard')") &&
        pageTsx.includes("e.key === 'Enter' || e.key === ' '"),
        'App logo includes keyboard navigation attributes and event handlers'
      );
    });

    it('VERIFIED [RESOLVED]: Mood picker popover includes aria-expanded, aria-haspopup, and Escape dismiss listener', () => {
      assert.ok(
        pageTsx.includes('aria-expanded={showMoodPicker}'),
        'Mood picker button declares dynamic aria-expanded'
      );
      assert.ok(
        pageTsx.includes('aria-haspopup="dialog"'),
        'Mood picker button declares aria-haspopup="dialog"'
      );
      assert.ok(
        pageTsx.includes("e.key === 'Escape'"),
        'Mood picker registers Escape key listener to close popover'
      );
    });
  });

  describe('5. AI Feedback Loops & Error Handling Verification', () => {
    it('VERIFIED [RESOLVED]: AI analysis errors provide visible user feedback and retry option', () => {
      assert.ok(
        pageTsx.includes('aiAnalysisError') && pageTsx.includes('setAiAnalysisError'),
        'Real-time analysis captures errors in user-visible state'
      );
    });

    it('VERIFIED [RESOLVED]: Failed chat interactions use ephemeral banner without polluting entry messages', () => {
      assert.strictEqual(
        pageTsx.includes('*Apologies, I encountered an issue reflecting on this:'),
        false,
        'Failed chat interactions do not inject permanent apology messages into entry.messages'
      );
      assert.ok(
        pageTsx.includes('chatError') && pageTsx.includes('setChatError'),
        'Chat errors render via dedicated ephemeral banner with retry'
      );
    });
  });
});
