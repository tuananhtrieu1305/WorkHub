export const REACTION_TRAY_CLOSE_DELAY_MS = 2000;
export const REACTION_TRAY_IDLE_TIMEOUT_MS = 2000;
export const REACTION_SELECTION_GUARD_MS = 450;
export const REACTION_TRAY_OPEN_EVENT = "workhub:reaction-tray-open";

const isSelectionGuardActive = ({
  didJustSelectReaction = false,
  elapsedMsSinceSelection = 0,
  guardMs = REACTION_SELECTION_GUARD_MS,
} = {}) => didJustSelectReaction && elapsedMsSinceSelection < guardMs;

export const shouldKeepReactionTrayOpen = ({
  isTriggerHovered = false,
  isTrayHovered = false,
} = {}) => isTriggerHovered || isTrayHovered;

export const shouldDelayReactionTrayClose = (hoverState = {}) =>
  !shouldKeepReactionTrayOpen(hoverState);

export const shouldCloseReactionTrayOnOutsidePointer = ({
  isOpen = false,
  isInsidePicker = false,
} = {}) => isOpen && !isInsidePicker;

export const shouldCloseReactionTrayForActivePickerChange = ({
  currentPickerId,
  nextPickerId,
} = {}) =>
  Boolean(currentPickerId && nextPickerId && currentPickerId !== nextPickerId);

export const shouldAutoCloseReactionTrayAfterIdle = ({
  isOpen = false,
  didSelectReaction = false,
} = {}) => isOpen && !didSelectReaction;

export const shouldSuppressTrayOpenAfterSelection = ({
  didJustSelectReaction = false,
  elapsedMsSinceSelection = 0,
  guardMs = REACTION_SELECTION_GUARD_MS,
} = {}) =>
  isSelectionGuardActive({
    didJustSelectReaction,
    elapsedMsSinceSelection,
    guardMs,
  });

export const shouldIgnoreTriggerClickAfterTraySelection = ({
  didJustSelectReaction = false,
  elapsedMsSinceSelection = 0,
  guardMs = REACTION_SELECTION_GUARD_MS,
} = {}) =>
  isSelectionGuardActive({
    didJustSelectReaction,
    elapsedMsSinceSelection,
    guardMs,
  });
