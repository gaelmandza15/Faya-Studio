/**
 * Final UI quality contract for generated applications.
 *
 * The goal is not to prescribe an implementation, but to give the agent a
 * reproducible acceptance pass over the subtle interface bugs that users
 * notice immediately: a notification badge that never clears, a drawer that
 * traps the page, a modal that loses focus, counts that drift from the list.
 */

export const UI_QUALITY_VERSION = 1;

export interface UiQualityCategory {
  id: string;
  title: string;
  checks: string[];
}

export const UI_QUALITY_CATEGORIES: UiQualityCategory[] = [
  {
    id: "shell",
    title: "Shell and navigation",
    checks: [
      "The burger/drawer trigger opens and closes the same panel; its icon and aria-expanded stay in sync.",
      "The mobile drawer closes on overlay click, Escape and after choosing a destination.",
      "Page scrolling is locked while the drawer is open, without losing the scroll position.",
      "Exactly one navigation item is active, and it matches the current view after reload and back/forward.",
      "The sidebar never overlaps content on desktop and is fully hidden on mobile until opened.",
      "No horizontal scrollbar at 360px; long labels truncate or wrap instead of pushing the layout.",
    ],
  },
  {
    id: "dropdowns",
    title: "Dropdowns, popovers and menus",
    checks: [
      "Clicking the trigger opens the panel; clicking it again closes it (no double-toggle).",
      "Clicking outside and pressing Escape close the panel and return focus to the trigger.",
      "Opening one dropdown closes any other open dropdown.",
      "The panel is not clipped by an ancestor overflow:hidden or a stacking context; it renders above content.",
      "aria-expanded, aria-controls and the visible state always agree.",
      "Choosing an item closes the menu when expected; keyboard navigation and Enter work.",
    ],
  },
  {
    id: "notifications",
    title: "Notifications, badges and alerts",
    checks: [
      "The badge count is derived from unread items, never hardcoded.",
      "Opening the panel marks items read (or a working 'mark all read' exists) and the badge clears.",
      "At zero unread items the badge is hidden entirely, not displayed as '0'.",
      "An empty state is shown when there are no notifications.",
      "Read state survives reloads and navigation.",
      "Dismissing one notification decrements the count exactly once; the count never goes negative.",
      "Alert counters on the dashboard, sidebar and badges update after read, dismiss, create or delete.",
      "Toasts auto-dismiss, can be closed manually, do not stack indefinitely and never block clicks.",
    ],
  },
  {
    id: "modals",
    title: "Modals and confirmations",
    checks: [
      "Dialogs open and close via the trigger, Escape and the intended backdrop behaviour.",
      "Focus moves into the dialog on open and returns to the trigger on close.",
      "Background scroll is locked while open and the page does not jump when it closes.",
      "Destructive actions require confirmation; cancelling leaves data untouched.",
      "Double-clicking a submit button cannot create duplicates or run the action twice.",
      "Dialogs fit 360x640 and 1440x900; long content scrolls inside the dialog.",
      "role=dialog/aria-modal and a labelled title are present.",
    ],
  },
  {
    id: "forms",
    title: "Forms and validation",
    checks: [
      "Every input, select and textarea has a visible label or an accessible name.",
      "Required and invalid fields show a visible message; the form never fails silently.",
      "Submit is disabled or busy during async work and double submission is impossible.",
      "Errors clear when the user corrects the field; success resets the form and closes the panel.",
      "Enter submits where expected, Escape cancels, and focus starts in the first field.",
      "Values typed before a validation error are preserved.",
      "Numeric, date and currency inputs reject invalid values and handle 0 and negatives as specified.",
      "Selects populate from live data and handle an empty list.",
      "Every non-submit button inside a form has type=button.",
    ],
  },
  {
    id: "lists",
    title: "Lists, tables and filters",
    checks: [
      "Loading, empty and error states are visually distinct; no '0 results' flash during loading.",
      "Search is case-insensitive, accent-tolerant when expected, and clears correctly.",
      "Search, filters and sort combine without stale rows or stale counters.",
      "The displayed result count matches the visible rows and updates after mutations.",
      "'Clear filters' restores the full list.",
      "Row actions target the correct row after sorting or filtering.",
      "Pagination or load-more resets on filter change and never duplicates rows.",
      "Tables scroll horizontally on mobile without breaking the page layout.",
      "A sticky header does not overlap the first row or the toolbar.",
    ],
  },
  {
    id: "data",
    title: "CRUD and data consistency",
    checks: [
      "Create, update and delete refresh the list, counters, dashboard KPIs and active filters immediately.",
      "Deleting a filtered row keeps the filter and shows the empty state when appropriate.",
      "Favourite, pin and status toggles persist and reorder items as specified.",
      "Related records stay consistent after deletion (company/contact, invoice/lines, etc.).",
      "Duplicate prevention works where required.",
      "Generated IDs do not collide after deletions or rapid creation.",
      "updated_at/timestamps refresh on edit and sorting by date stays correct.",
      "Data survives a full reload on both desktop (SQLite) and browser preview paths.",
      "Desktop and browser paths return the same shapes and values.",
      "SQL or storage errors surface a readable message instead of failing silently.",
    ],
  },
  {
    id: "responsive",
    title: "Responsive behaviour",
    checks: [
      "The app is usable at 360/390, 768, 1024 and 1440 widths.",
      "No horizontal overflow at any of those widths.",
      "The sidebar becomes a drawer on mobile and the burger is the only way to open it.",
      "Touch targets are at least ~40px and not overlapped by sticky bars.",
      "Modals and forms fit and scroll at 360x640.",
      "Tables and card grids adapt instead of being squashed.",
      "Header actions do not overlap the page title on small screens.",
    ],
  },
  {
    id: "a11y",
    title: "Accessibility",
    checks: [
      "Primary flows are completable with the keyboard only.",
      "Focus is always visible; no outline:none without a focus-visible replacement.",
      "Icon-only buttons have an aria-label or title with the same meaning.",
      "Images have alt text; decorative images use alt=\"\".",
      "aria-expanded, aria-pressed and aria-current reflect the real state.",
      "Text and icons meet reasonable contrast on their background.",
      "Large animations respect prefers-reduced-motion.",
      "Dialogs and forms expose accessible names.",
    ],
  },
  {
    id: "visual",
    title: "Visual consistency",
    checks: [
      "Spacing follows one scale and adjacent edges line up.",
      "The same component looks the same everywhere (buttons, cards, badges, inputs).",
      "Icon sizes and stroke widths are consistent.",
      "Colours come from the design tokens, not arbitrary one-off hex values.",
      "Radii, borders and shadows are consistent.",
      "Loading, empty and error states share the same visual language.",
      "Truncation never cuts a control or an essential value.",
      "Hover, focus, active and disabled states exist and are distinguishable.",
      "No placeholder copy remains (Lorem ipsum, TODO, FIXME, 'Bouton 1').",
      "No dead control: every button or link does something, or is visibly disabled with a reason.",
    ],
  },
  {
    id: "state",
    title: "State and edge cases",
    checks: [
      "First run with an empty database shows empty states, not crashes.",
      "Reloading during or right after an action does not corrupt data or leave a stuck spinner.",
      "Rapid repeated clicks do not duplicate records or desynchronise counters.",
      "Browser back/forward restores the expected view and filters where applicable.",
      "Multiple tabs do not silently overwrite each other; sync/refresh behaviour is coherent.",
      "Offline or failed requests show a retry path in synced apps.",
      "Very long names, notes and numbers do not break layout or buttons.",
      "Deleting the last item shows the empty state and zero counters.",
      "Sorting with equal values is stable.",
      "Date boundaries (today, month start/end, leap year) behave correctly.",
    ],
  },
  {
    id: "acceptance",
    title: "Final acceptance",
    checks: [
      "Re-read the original request and confirm every requested workflow exists.",
      "Trace each primary button to its handler and to the state update it triggers.",
      "For every count or badge, verify it derives from the same source as the displayed list.",
      "Walk each primary flow once checking the browser console for errors.",
      "Confirm there is no placeholder text, unused control or unimplemented 'coming soon' action.",
      "Re-run run_checks after the fixes.",
    ],
  },
];

export function buildUiQualityPrompt(
  mode: "generate" | "modify" = "generate",
): string {
  const sections = UI_QUALITY_CATEGORIES.map(
    (category) =>
      `${category.title.toUpperCase()}\n${category.checks
        .map((check) => `- ${check}`)
        .join("\n")}`,
  ).join("\n\n");

  const intro =
    mode === "modify"
      ? "Before calling finish, audit the flows touched by this change and the adjacent interactions they can regress (counts, badges, navigation, filters, dialogs). Fix every real failure. Do not claim a check passed unless the corresponding code path exists."
      : "Before calling finish, audit the application against this checklist. Inspect the handlers, state and CSS that implement each check and fix every real failure. Do not claim a check passed unless the corresponding code path exists. This pass targets the subtle finishing bugs users notice immediately, not new features.";

  return [
    "FINAL UI QUALITY PASS",
    intro,
    "",
    sections,
    "",
    "Then run run_checks again. In the final summary, mention the UI issues you fixed; do not dump the whole checklist.",
  ].join("\n");
}
