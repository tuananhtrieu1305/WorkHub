import { createElement } from "react";
import { gooeyToast } from "goey-toast";

const defaultClassNames = {
  wrapper: "workhub-toast-wrapper",
  content: "workhub-toast-content",
  header: "workhub-toast-header",
  title: "workhub-toast-title",
  icon: "workhub-toast-icon-wrap",
  description: "workhub-toast-description",
  actionWrapper: "workhub-toast-action-wrapper",
  actionButton: "workhub-toast-action",
};

const toastStyles = {
  default: {
    fillColor: "#f8fafc",
    borderColor: "#cbd5e1",
    icon: "notifications",
  },
  success: {
    fillColor: "#ecfdf5",
    borderColor: "#34d399",
    icon: "task_alt",
  },
  error: {
    fillColor: "#fff1f2",
    borderColor: "#fb7185",
    icon: "error",
  },
  warning: {
    fillColor: "#fffbeb",
    borderColor: "#f59e0b",
    icon: "warning",
  },
  info: {
    fillColor: "#eff6ff",
    borderColor: "#60a5fa",
    icon: "info",
  },
};

const defaultOptions = {
  preset: "smooth",
  showTimestamp: false,
  borderWidth: 1.5,
};

const cx = (...classes) => classes.filter(Boolean).join(" ");

const mergeClassNames = (classNames) => ({
  ...defaultClassNames,
  ...(classNames || {}),
});

const normalizeExpandedTiming = (options) => {
  if (!options || typeof options !== "object") return options || {};

  const hasExpandedContent = Boolean(options.description || options.action);
  if (!hasExpandedContent || typeof options.duration !== "number") {
    return options;
  }

  return {
    ...options,
    timing: {
      displayDuration: options.duration,
      ...(options.timing || {}),
    },
  };
};

const hasDescription = (description) =>
  description !== undefined && description !== null && description !== "";

const normalizePromiseDescriptions = (description) => {
  if (!description || typeof description !== "object") return undefined;

  const nextDescription = {};
  ["loading", "success", "error"].forEach((key) => {
    if (hasDescription(description[key])) {
      nextDescription[key] = description[key];
    }
  });

  return Object.keys(nextDescription).length ? nextDescription : undefined;
};

const toTitle = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value?.message || "Thông báo";
};

const normalizeOptions = (type, title, options = {}) => {
  const typedStyle = toastStyles[type] || toastStyles.default;
  const rawOptions =
    typeof options === "number" ? { duration: options * 1000 } : options || {};
  const normalizedOptions = normalizeExpandedTiming(rawOptions);

  return {
    ...defaultOptions,
    fillColor: typedStyle.fillColor,
    borderColor: typedStyle.borderColor,
    icon:
      normalizedOptions.icon ??
      createElement(
        "span",
        {
          className: cx(
            "material-symbols-outlined",
            "workhub-toast-icon",
            `workhub-toast-icon-${type}`,
          ),
        },
        typedStyle.icon,
      ),
    ...normalizedOptions,
    classNames: mergeClassNames(normalizedOptions.classNames),
  };
};

const show = (type, title, options) => {
  const normalizedTitle = toTitle(title);
  const normalizedOptions = normalizeOptions(type, normalizedTitle, options);

  if (type === "default") {
    return gooeyToast(normalizedTitle, normalizedOptions);
  }

  return gooeyToast[type](normalizedTitle, normalizedOptions);
};

const writeTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const details = (rows = []) => {
  const visibleRows = rows.filter(
    (row) => row && row.value !== undefined && row.value !== null && row.value !== "",
  );

  if (!visibleRows.length) return null;

  return createElement(
    "div",
    { className: "workhub-toast-details" },
    visibleRows.map((row, index) =>
      createElement(
        "div",
        { className: "workhub-toast-detail-row", key: `${row.label}-${index}` },
        createElement("span", { className: "workhub-toast-detail-label" }, row.label),
        createElement("span", { className: "workhub-toast-detail-value" }, row.value),
      ),
    ),
  );
};

const body = ({ text, rows, note } = {}) =>
  text || rows?.length || note
    ? createElement(
        "div",
        { className: "workhub-toast-body" },
        text ? createElement("p", null, text) : null,
        details(rows),
        note
          ? createElement("p", { className: "workhub-toast-confirm-note" }, note)
          : null,
      )
    : null;

const promise = (pendingPromise, data = {}) => {
  const { duration, description, ...promiseOptions } = data || {};
  const promiseDescription = normalizePromiseDescriptions(description);
  const timing =
    typeof duration === "number"
      ? {
          displayDuration: duration,
          ...(promiseOptions.timing || {}),
        }
      : promiseOptions.timing;

  return gooeyToast.promise(pendingPromise, {
    ...defaultOptions,
    ...promiseOptions,
    ...(promiseDescription ? { description: promiseDescription } : {}),
    ...(timing ? { timing } : {}),
    classNames: mergeClassNames(promiseOptions.classNames),
  });
};

const actionToast = (
  type,
  title,
  {
    actionLabel = "Thực hiện",
    actionSuccessLabel = "Đã xong",
    successLabel,
    description,
    onAction,
    rows,
    text,
    note,
    ...toastOptions
  } = {},
) =>
  show(type, title, {
    description:
      description ??
      body({
        text,
        rows,
        note,
      }),
    action: onAction
      ? {
          label: actionLabel,
          onClick: onAction,
          successLabel: successLabel || actionSuccessLabel,
        }
      : undefined,
    ...toastOptions,
  });

const copySuccess = (title, copiedText, options = {}) => {
  const { actionLabel, description, label, text, ...toastOptions } = options;

  return show("success", title, {
    description:
      description ??
      body({
        text: text || "Nội dung đã sẵn sàng trong clipboard.",
        rows: label ? [{ label, value: copiedText }] : undefined,
      }),
    action: copiedText
      ? {
          label: actionLabel || "Sao chép lại",
          onClick: () => writeTextToClipboard(copiedText),
          successLabel: "Đã sao chép",
        }
      : undefined,
    ...toastOptions,
  });
};

const confirm = ({
  title = "Xác nhận thao tác",
  description,
  detailRows,
  note = "Thao tác này sẽ được thực hiện ngay sau khi xác nhận. Đóng thông báo để hủy.",
  confirmLabel = "Xác nhận",
  successLabel = "Đã xác nhận",
  type = "warning",
  duration = 12000,
} = {}) =>
  new Promise((resolve) => {
    let settled = false;
    let toastId;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    toastId = show(type, title, {
      duration,
      showProgress: true,
      description: body({
        text: description,
        rows: detailRows,
        note,
      }),
      action: {
        label: confirmLabel,
        onClick: () => {
          settle(true);
          window.setTimeout(() => gooeyToast.dismiss(toastId), 350);
        },
        successLabel,
      },
      onDismiss: () => settle(false),
      onAutoClose: () => settle(false),
    });
  });

export const workHubToast = {
  open: (title, options) => show("default", title, options),
  default: (title, options) => show("default", title, options),
  success: (title, options) => show("success", title, options),
  error: (title, options) => show("error", title, options),
  warning: (title, options) => show("warning", title, options),
  info: (title, options) => show("info", title, options),
  promise,
  action: actionToast,
  copySuccess,
  confirm,
  body,
  details,
  dismiss: gooeyToast.dismiss,
  destroy: gooeyToast.dismiss,
  update: (id, options = {}) =>
    gooeyToast.update(id, {
      ...options,
      classNames: mergeClassNames(options.classNames),
    }),
};

export const useWorkHubToast = () => workHubToast;
