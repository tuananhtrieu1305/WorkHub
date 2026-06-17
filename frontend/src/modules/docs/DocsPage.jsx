import { useCallback, useEffect, useMemo, useState } from "react";
import { createFolder, getFolders } from "../../api/folderApi";
import {
  deleteDocument as deleteDocumentApi,
  fetchDocumentDownloadBlob,
  fetchDocumentPreviewBlob,
  getDocumentStats,
  getDocuments,
  shareDocument,
  updateDocument,
  uploadDocument,
  uploadDocumentVersion,
} from "../../api/documentApi";
import { useAuth } from "../../context/AuthContext";
import {
  copyTextToClipboard,
  getOrganizationId,
  hasPermission,
} from "../organization/organizationUtils";
import { useWorkHubToast } from "../../components/feedback/workHubToast";
import "../../styles/docs/docs.css";

const categoryLabels = {
  all: "Tất cả nhóm",
  general: "Tổng hợp",
  policy: "Quy định",
  report: "Báo cáo",
  contract: "Hợp đồng",
  design: "Thiết kế",
  finance: "Tài chính",
  technical: "Kỹ thuật",
  other: "Khác",
};

const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({
  value,
  label,
}));

const extensionFilterOptions = [
  { value: "all", label: "Tất cả", icon: "draft" },
  { value: ".pdf", label: "PDF", icon: "picture_as_pdf" },
  { value: ".docx", label: "DOCX", icon: "description" },
  { value: ".xlsx", label: "XLSX", icon: "table_chart" },
  { value: ".pptx", label: "PPTX", icon: "co_present" },
  { value: ".png", label: "PNG", icon: "image" },
  { value: ".jpg", label: "JPG", icon: "image" },
  { value: ".txt", label: "TXT", icon: "article" },
];

const statusLabels = {
  active: "Sẵn sàng",
  uploading: "Đang tải",
  pending_scan: "Đang kiểm tra",
  failed: "Lỗi upload",
  deleted: "Đã xóa",
};

const extensionIcon = {
  ".pdf": "picture_as_pdf",
  ".docx": "description",
  ".xlsx": "table_chart",
  ".pptx": "co_present",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".txt": "article",
};

const extensionTone = {
  ".pdf": "rose",
  ".docx": "blue",
  ".xlsx": "emerald",
  ".pptx": "amber",
  ".png": "cyan",
  ".jpg": "cyan",
  ".jpeg": "cyan",
  ".txt": "slate",
};

const defaultFilters = {
  search: "",
  folderId: "",
  extension: "all",
  owner: "all",
  sort: "recent",
};

const defaultUploadForm = {
  file: null,
  folderId: "",
  name: "",
  description: "",
  tags: "",
};

const defaultShareForm = {
  mode: "fixed_version",
  permission: "view",
  expiry: "",
  maxDownloads: "",
};

const getDocumentExtension = (document) =>
  document?.currentVersion?.extension || ".txt";

const formatFileSize = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDateTime = (value) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa có";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const buildEmptyUploadTrend = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    return {
      key: getLocalDateKey(date),
      label: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: 0,
    };
  });
};

const normalizeUploadTrend = (trend) => {
  const source = Array.isArray(trend) && trend.length ? trend.slice(-14) : buildEmptyUploadTrend();
  return source.map((item, index) => ({
    key: item.key || `trend-${index}`,
    label: item.label || item.key || `Ngày ${index + 1}`,
    value: Number.isFinite(Number(item.value)) ? Number(item.value) : 0,
  }));
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const buildTags = (value = "") =>
  String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "document";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
};

const openBlob = (blob) => {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const IconButton = ({
  children,
  disabled,
  label,
  onClick,
  tone = "slate",
  type = "button",
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`docs-icon-button docs-icon-button--${tone}`}
    title={label}
    aria-label={label}
  >
    <span className="material-symbols-outlined text-[20px] leading-none">
      {children}
    </span>
  </button>
);

const FieldLabel = ({ children }) => (
  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
    {children}
  </span>
);

const PortalModal = ({ children, onClose, title, subtitle }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-700/25 px-4 py-6 backdrop-blur-sm">
    <div className="docs-modal max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-950">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        <IconButton label="Đóng" onClick={onClose}>
          close
        </IconButton>
      </div>
      {children}
    </div>
  </div>
);

const DocumentIcon = ({ document }) => {
  const extension = getDocumentExtension(document);
  const tone = extensionTone[extension] || "violet";
  return (
    <div className={`docs-file-icon docs-file-icon--${tone}`}>
      <span className="material-symbols-outlined icon-fill">
        {extensionIcon[extension] || "draft"}
      </span>
    </div>
  );
};

const DocsStats = ({ stats }) => {
  const summary = stats?.summary || {};
  const trendItems = normalizeUploadTrend(stats?.trend);
  const maxTrend = Math.max(1, ...trendItems.map((item) => item.value));
  const totalTrendUploads = trendItems.reduce((total, item) => total + item.value, 0);

  return (
    <section className="docs-stats-grid">
      {[
        {
          icon: "folder_managed",
          label: "Tài liệu",
          value: summary.totalDocuments || 0,
          detail: `${summary.totalFolders || 0} thư mục`,
          tone: "blue",
        },
        {
          icon: "database",
          label: "Dung lượng",
          value: formatFileSize(summary.storageBytes || 0),
          detail: "đang lưu trữ",
          tone: "emerald",
        },
        {
          icon: "verified",
          label: "Sẵn sàng",
          value: summary.activeDocuments || 0,
          detail: `${summary.failedDocuments || 0} file lỗi`,
          tone: "cyan",
        },
        {
          icon: "insights",
          label: "Tương tác",
          value: (summary.downloads || 0) + (summary.previews || 0),
          detail: `${summary.downloads || 0} tải xuống`,
          tone: "amber",
        },
      ].map((item) => (
        <article key={item.label} className={`docs-stat-card docs-stat-card--${item.tone}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="material-symbols-outlined icon-fill text-2xl">
              {item.icon}
            </span>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black uppercase text-slate-500">
              {item.label}
            </span>
          </div>
          <p className="mt-5 text-3xl font-black text-slate-950">{item.value}</p>
          <p className="text-sm font-bold text-slate-500">{item.detail}</p>
        </article>
      ))}

      <article className="docs-trend-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-500">
              Nhịp upload 14 ngày
            </h3>
            <p className="text-xs font-bold text-slate-400">
              Theo ngày tạo tài liệu trong tổ chức
            </p>
          </div>
          <span className="material-symbols-outlined text-cyan-600">
            monitoring
          </span>
        </div>
        <div className="docs-trend-summary">
          <span>{totalTrendUploads} lượt upload</span>
          <span>14 ngày gần nhất</span>
        </div>
        <div className="docs-trend-chart">
          {trendItems.map((item, index) => {
            const barHeight = item.value > 0 ? Math.max(16, (item.value / maxTrend) * 100) : 8;
            return (
              <div key={item.key} className="group flex flex-1 flex-col items-center gap-2">
                <div className="docs-trend-bar-shell">
                  <div
                    className={`docs-trend-bar ${item.value === 0 ? "is-empty" : ""}`}
                    style={{
                      "--bar-height": `${barHeight}%`,
                      "--bar-delay": `${index * 45}ms`,
                    }}
                    title={`${item.label}: ${item.value}`}
                  >
                    <span>{item.value}</span>
                  </div>
                </div>
                <span className="hidden text-[10px] font-bold text-slate-400 sm:inline">
                {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
};

const FolderRail = ({
  activeFolderId,
  canManageFolders,
  folders,
  onCreateFolder,
  onSelectFolder,
}) => (
  <aside className="docs-folder-rail">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-black uppercase text-slate-500">Thư mục</h2>
      {canManageFolders && (
        <IconButton label="Tạo thư mục" onClick={onCreateFolder} tone="cyan">
          create_new_folder
        </IconButton>
      )}
    </div>
    <button
      type="button"
      onClick={() => onSelectFolder("")}
      className={`docs-folder-chip ${!activeFolderId ? "is-active" : ""}`}
    >
      <span className="material-symbols-outlined icon-fill">inventory_2</span>
      <span className="min-w-0 flex-1 truncate">Tất cả tài liệu</span>
    </button>
    {folders.map((folder) => (
      <button
        type="button"
        key={folder._id || folder.id}
        onClick={() => onSelectFolder(folder._id || folder.id)}
        className={`docs-folder-chip ${
          activeFolderId === (folder._id || folder.id) ? "is-active" : ""
        }`}
      >
        <span className="material-symbols-outlined">
          {folder.isDefaultPortalFolder ? "folder_shared" : "folder"}
        </span>
        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
      </button>
    ))}
    {!folders.length && (
      <div className="rounded-2xl bg-cyan-50 p-4 text-sm font-semibold text-cyan-800 ring-1 ring-cyan-100">
        Upload đầu tiên sẽ tự tạo thư mục chung cho tổ chức.
      </div>
    )}
  </aside>
);

const DocumentRow = ({
  document,
  onDelete,
  onDownload,
  onEdit,
  onPreview,
  onShare,
  onUploadVersion,
}) => {
  const size = document.currentVersion?.size || 0;
  const extension = getDocumentExtension(document);
  const capabilities = document.capabilities || {};

  return (
    <article className="docs-document-row">
      <div className="flex min-w-0 items-start gap-4">
        <DocumentIcon document={document} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="max-w-full truncate text-base font-black text-slate-950">
              {document.name}
            </h3>
            <span className="docs-status-pill">
              {statusLabels[document.status] || document.status}
            </span>
            <span className="docs-category-pill">
              {categoryLabels[document.category] || "Tổng hợp"}
            </span>
          </div>
          {document.description && (
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-500">
              {document.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px]">person</span>
              {document.owner?.fullName || "Không rõ"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px]">folder</span>
              {document.folder?.name || "Tài liệu chung"}
            </span>
            <span>{extension.replace(".", "").toUpperCase()} · {formatFileSize(size)}</span>
            <span>v{document.versionCounter || 1}</span>
            <span>Cập nhật {formatDateTime(document.updatedAt)}</span>
          </div>
          {!!document.tags?.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {document.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="docs-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="docs-row-actions">
        <IconButton label="Xem trước" onClick={() => onPreview(document)} tone="cyan">
          visibility
        </IconButton>
        <IconButton label="Tải xuống" onClick={() => onDownload(document)} tone="emerald">
          download
        </IconButton>
        {capabilities.canShare && (
          <IconButton label="Chia sẻ" onClick={() => onShare(document)} tone="blue">
            ios_share
          </IconButton>
        )}
        {capabilities.canEdit && (
          <IconButton label="Sửa thông tin" onClick={() => onEdit(document)} tone="amber">
            edit
          </IconButton>
        )}
        {capabilities.canUploadVersion && (
          <IconButton
            label="Upload phiên bản mới"
            onClick={() => onUploadVersion(document)}
            tone="violet"
          >
            history
          </IconButton>
        )}
        {capabilities.canDelete && (
          <IconButton label="Xóa" onClick={() => onDelete(document)} tone="rose">
            delete
          </IconButton>
        )}
      </div>
    </article>
  );
};

const DocsPage = () => {
  const { user } = useAuth();
  const message = useWorkHubToast();
  const organization = user?.activeOrganization;
  const organizationId = getOrganizationId(organization);
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState(null);
  const [capabilities, setCapabilities] = useState({});
  const [filters, setFilters] = useState(defaultFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(defaultUploadForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editDocument, setEditDocument] = useState(null);
  const [versionDocument, setVersionDocument] = useState(null);
  const [versionFile, setVersionFile] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareForm, setShareForm] = useState(defaultShareForm);
  const [shareLink, setShareLink] = useState("");
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [pageState, setPageState] = useState({
    currentPage: 1,
    totalPages: 0,
    totalElements: 0,
  });

  const roleCanViewStats =
    hasPermission(organization, "viewDocumentInsights") ||
    hasPermission(organization, "manageDocuments");
  const canViewStats = capabilities.canViewInsights ?? roleCanViewStats;
  const canManageFolders =
    capabilities.canManageFolders ||
    hasPermission(organization, "manageDocumentFolders") ||
    hasPermission(organization, "manageDocuments");

  const selectedFolderName = useMemo(() => {
    if (!filters.folderId) return "Tất cả tài liệu";
    return (
      folders.find((folder) => (folder._id || folder.id) === filters.folderId)?.name ||
      "Thư mục đã chọn"
    );
  }, [filters.folderId, folders]);

  const loadFolders = useCallback(async () => {
    if (!organizationId) return;
    const payload = await getFolders();
    setFolders(payload || []);
  }, [organizationId]);

  const loadDocuments = useCallback(
    async (page = 1) => {
      if (!organizationId) {
        setDocuments([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const payload = await getDocuments({
          ...filters,
          page,
          size: 18,
        });
        setDocuments(payload.content || []);
        setCapabilities(payload.capabilities || {});
        setPageState({
          currentPage: payload.currentPage || 1,
          totalPages: payload.totalPages || 0,
          totalElements: payload.totalElements || 0,
        });
      } catch (error) {
        message.error("Không thể tải tài liệu", {
          description: getErrorMessage(error, "Thử lại sau ít phút."),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [filters, message, organizationId],
  );

  const loadStats = useCallback(async () => {
    if (!organizationId || !roleCanViewStats) {
      setStats(null);
      return;
    }
    setIsStatsLoading(true);
    try {
      const payload = await getDocumentStats();
      setStats(payload);
      setCapabilities((current) => ({ ...current, ...(payload.capabilities || {}) }));
    } catch {
      setStats(null);
    } finally {
      setIsStatsLoading(false);
    }
  }, [organizationId, roleCanViewStats]);

  const refreshPortal = useCallback(async () => {
    await Promise.all([loadDocuments(1), loadFolders(), loadStats()]);
  }, [loadDocuments, loadFolders, loadStats]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchDraft }));
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  useEffect(() => {
    setSearchDraft("");
    setFilters(defaultFilters);
  }, [organizationId]);

  useEffect(() => {
    refreshPortal();
  }, [refreshPortal]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadForm.file) {
      message.warning("Chọn file trước khi upload");
      return;
    }
    const formData = new FormData();
    formData.append("file", uploadForm.file);
    if (uploadForm.name.trim()) formData.append("name", uploadForm.name.trim());
    formData.append("description", uploadForm.description);
    formData.append("tags", JSON.stringify(buildTags(uploadForm.tags)));
    if (uploadForm.folderId) formData.append("folderId", uploadForm.folderId);

    setIsSubmitting(true);
    try {
      await uploadDocument(uploadForm.folderId, formData);
      setUploadOpen(false);
      setUploadForm(defaultUploadForm);
      message.success("Đã upload tài liệu", {
        description: "Tài liệu đã sẵn sàng trong portal của tổ chức.",
      });
      await refreshPortal();
    } catch (error) {
      message.error("Không thể upload tài liệu", {
        description: getErrorMessage(error, "Kiểm tra loại file hoặc quyền upload."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editDocument) return;
    setIsSubmitting(true);
    try {
      await updateDocument(editDocument.id, {
        name: editDocument.name,
        description: editDocument.description,
        category: editDocument.category,
        folderId: editDocument.folderId,
        tags: buildTags(editDocument.tagsText),
      });
      setEditDocument(null);
      message.success("Đã cập nhật tài liệu");
      await refreshPortal();
    } catch (error) {
      message.error("Không thể cập nhật tài liệu", {
        description: getErrorMessage(error, "Kiểm tra lại quyền chỉnh sửa."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadVersion = async (event) => {
    event.preventDefault();
    if (!versionDocument || !versionFile) {
      message.warning("Chọn file phiên bản mới");
      return;
    }
    const formData = new FormData();
    formData.append("file", versionFile);
    setIsSubmitting(true);
    try {
      await uploadDocumentVersion(versionDocument.id, formData);
      setVersionDocument(null);
      setVersionFile(null);
      message.success("Đã thêm phiên bản mới");
      await refreshPortal();
    } catch (error) {
      message.error("Không thể upload phiên bản", {
        description: getErrorMessage(error, "File chưa hợp lệ hoặc bạn không có quyền."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (document) => {
    const confirmed = await message.confirm({
      title: "Xóa tài liệu?",
      description: "Tài liệu sẽ biến mất khỏi portal của tổ chức sau khi xác nhận.",
      confirmLabel: "Xóa tài liệu",
      successLabel: "Đang xóa",
      type: "error",
      detailRows: [
        { label: "Tên", value: document.name },
        { label: "Người upload", value: document.owner?.fullName || "Không rõ" },
      ],
    });
    if (!confirmed) return;

    try {
      await deleteDocumentApi(document.id);
      message.success("Đã xóa tài liệu");
      await refreshPortal();
    } catch (error) {
      message.error("Không thể xóa tài liệu", {
        description: getErrorMessage(error, "Bạn chỉ có thể xóa tài liệu của mình hoặc khi role cho phép."),
      });
    }
  };

  const handlePreview = async (document) => {
    try {
      const response = await fetchDocumentPreviewBlob(document.id);
      openBlob(response.data);
    } catch (error) {
      message.error("Không thể mở preview", {
        description: getErrorMessage(error, "File chưa sẵn sàng hoặc bạn không có quyền."),
      });
    }
  };

  const handleDownload = async (document) => {
    try {
      const response = await fetchDocumentDownloadBlob(document.id);
      downloadBlob(response.data, document.name);
      await loadStats();
    } catch (error) {
      message.error("Không thể tải xuống", {
        description: getErrorMessage(error, "File chưa sẵn sàng hoặc bạn không có quyền."),
      });
    }
  };

  const openEditModal = (document) => {
    setEditDocument({
      ...document,
      folderId: document.folderId || "",
      tagsText: (document.tags || []).join(", "),
    });
  };

  const openShareModal = (document) => {
    setShareTarget(document);
    setShareForm(defaultShareForm);
    setShareLink("");
  };

  const handleCreateShare = async (event) => {
    event.preventDefault();
    if (!shareTarget) return;
    setIsSubmitting(true);
    try {
      const payload = {
        mode: shareForm.mode,
        permission: shareForm.permission,
        expiry: shareForm.expiry || undefined,
        maxDownloads: shareForm.maxDownloads
          ? Number(shareForm.maxDownloads)
          : undefined,
      };
      const response = await shareDocument(shareTarget.id, payload);
      setShareLink(response.shareLink || "");
      if (response.shareLink) {
        await copyTextToClipboard(response.shareLink);
      }
      message.success("Đã tạo liên kết chia sẻ", {
        description: "Liên kết đã được sao chép vào clipboard.",
      });
    } catch (error) {
      message.error("Không thể tạo chia sẻ", {
        description: getErrorMessage(error, "Kiểm tra quyền chia sẻ tài liệu."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFolder = async (event) => {
    event.preventDefault();
    if (!folderName.trim()) return;
    setIsSubmitting(true);
    try {
      await createFolder({
        name: folderName.trim(),
        permissions: {
          visibility: "organization",
          users: [],
        },
      });
      setFolderName("");
      setFolderModalOpen(false);
      message.success("Đã tạo thư mục");
      await loadFolders();
    } catch (error) {
      message.error("Không thể tạo thư mục", {
        description: getErrorMessage(error, "Role của bạn chưa có quyền quản lý thư mục."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="material-symbols-outlined text-7xl text-cyan-300">
          folder_off
        </span>
        <h1 className="mt-4 text-3xl font-black text-slate-950">
          Chưa có tổ chức đang hoạt động
        </h1>
        <p className="mt-2 max-w-xl text-sm font-semibold text-slate-500">
          Document portal chỉ hiển thị tài liệu theo tổ chức. Hãy tạo hoặc tham gia một tổ chức để bắt đầu.
        </p>
      </div>
    );
  }

  return (
    <div className="docs-page mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="docs-hero">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-wide text-cyan-700">
            {organization?.name || "WorkHub"}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
            Kho tài liệu tổ chức
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
            {canViewStats
              ? "Theo dõi, chia sẻ và quản trị tài liệu chung của tổ chức từ một nơi duy nhất."
              : "Xem tài liệu chung, upload tài liệu của bạn và quản lý các file do chính bạn tải lên."}
          </p>
        </div>
        <div className="docs-hero-actions">
          {canManageFolders && (
            <button
              type="button"
              onClick={() => setFolderModalOpen(true)}
              className="docs-secondary-button"
            >
              <span className="material-symbols-outlined">create_new_folder</span>
              Thư mục mới
            </button>
          )}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="docs-primary-button"
          >
            <span className="material-symbols-outlined icon-fill">upload_file</span>
            Upload tài liệu
          </button>
        </div>
      </section>

      {canViewStats && stats && <DocsStats stats={stats} />}
      {canViewStats && isStatsLoading && (
        <div className="rounded-[1.5rem] bg-white p-5 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
          Đang tải thống kê tài liệu...
        </div>
      )}

      <section className="docs-toolbar">
        <label className="docs-search-box">
          <span className="material-symbols-outlined text-cyan-600">search</span>
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Tìm theo tên, mô tả, tag..."
          />
        </label>
        <div className="docs-file-filter" aria-label="Lọc theo loại file">
          {extensionFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleFilterChange("extension", option.value)}
              className={`docs-file-filter-chip ${
                filters.extension === option.value ? "is-active" : ""
              }`}
              title={option.label}
            >
              <span className="material-symbols-outlined text-[18px]">
                {option.icon}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <select
          value={filters.owner}
          onChange={(event) => handleFilterChange("owner", event.target.value)}
          className="docs-select"
        >
          <option value="all">Mọi người upload</option>
          <option value="mine">Tài liệu của tôi</option>
        </select>
        <select
          value={filters.sort}
          onChange={(event) => handleFilterChange("sort", event.target.value)}
          className="docs-select"
        >
          <option value="recent">Mới cập nhật</option>
          <option value="created">Mới upload</option>
          <option value="name">Tên A-Z</option>
          <option value="oldest">Cũ nhất</option>
        </select>
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <FolderRail
          activeFolderId={filters.folderId}
          canManageFolders={canManageFolders}
          folders={folders}
          onCreateFolder={() => setFolderModalOpen(true)}
          onSelectFolder={(folderId) => handleFilterChange("folderId", folderId)}
        />

        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                {selectedFolderName}
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                {pageState.totalElements} tài liệu phù hợp bộ lọc hiện tại
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="docs-skeleton-row" />
              ))}
            </div>
          ) : documents.length ? (
            <div className="grid gap-3">
              {documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  onEdit={openEditModal}
                  onPreview={handlePreview}
                  onShare={openShareModal}
                  onUploadVersion={(item) => {
                    setVersionDocument(item);
                    setVersionFile(null);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="docs-empty-state">
              <span className="material-symbols-outlined text-7xl text-cyan-300">
                draft
              </span>
              <h3 className="mt-3 text-xl font-black text-slate-950">
                Chưa có tài liệu phù hợp
              </h3>
              <p className="mt-2 max-w-lg text-sm font-semibold text-slate-500">
                Thử đổi bộ lọc hoặc upload tài liệu đầu tiên cho tổ chức.
              </p>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="docs-primary-button mt-5"
              >
                <span className="material-symbols-outlined icon-fill">upload_file</span>
                Upload tài liệu
              </button>
            </div>
          )}

          {pageState.totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={pageState.currentPage <= 1}
                onClick={() => loadDocuments(pageState.currentPage - 1)}
                className="docs-page-button"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="text-sm font-black text-slate-500">
                Trang {pageState.currentPage}/{pageState.totalPages}
              </span>
              <button
                type="button"
                disabled={pageState.currentPage >= pageState.totalPages}
                onClick={() => loadDocuments(pageState.currentPage + 1)}
                className="docs-page-button"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </section>
      </div>

      {uploadOpen && (
        <PortalModal
          title="Upload tài liệu"
          subtitle="File sẽ thuộc tổ chức hiện tại và mặc định hiển thị cho thành viên cùng tổ chức."
          onClose={() => setUploadOpen(false)}
        >
          <form onSubmit={handleUpload} className="mt-6 grid gap-4">
            <label className="docs-dropzone">
              <span className="material-symbols-outlined icon-fill text-4xl text-cyan-600">
                upload_file
              </span>
              <span className="text-sm font-black text-slate-900">
                {uploadForm.file?.name || "Chọn PDF, DOCX, XLSX, PPTX, PNG, JPG hoặc TXT"}
              </span>
              <span className="text-xs font-bold text-slate-500">
                Hệ thống sẽ kiểm tra MIME và chặn file thực thi.
              </span>
              <input
                type="file"
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    file: event.target.files?.[0] || null,
                    name: current.name || event.target.files?.[0]?.name || "",
                  }))
                }
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <FieldLabel>Thư mục</FieldLabel>
                <select
                  value={uploadForm.folderId}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      folderId: event.target.value,
                    }))
                  }
                  className="docs-input"
                >
                  <option value="">Tài liệu chung mặc định</option>
                  {folders.map((folder) => (
                    <option key={folder._id || folder.id} value={folder._id || folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <FieldLabel>Tên hiển thị</FieldLabel>
                <input
                  value={uploadForm.name}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="docs-input"
                  placeholder="VD: Quy chế lương thưởng 2026"
                />
              </label>
            </div>
            <label className="grid gap-2">
              <FieldLabel>Mô tả</FieldLabel>
              <textarea
                value={uploadForm.description}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                className="docs-input min-h-28 resize-none py-3"
                placeholder="Ghi chú ngắn để mọi người biết tài liệu này dùng cho việc gì..."
              />
            </label>
            <label className="grid gap-2">
              <FieldLabel>Tags</FieldLabel>
              <input
                value={uploadForm.tags}
                onChange={(event) =>
                  setUploadForm((current) => ({ ...current, tags: event.target.value }))
                }
                className="docs-input"
                placeholder="onboarding, sprint, hợp đồng"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="docs-secondary-button"
              >
                Hủy
              </button>
              <button type="submit" disabled={isSubmitting} className="docs-primary-button">
                <span className="material-symbols-outlined icon-fill">cloud_upload</span>
                {isSubmitting ? "Đang upload..." : "Upload"}
              </button>
            </div>
          </form>
        </PortalModal>
      )}

      {editDocument && (
        <PortalModal
          title="Cập nhật tài liệu"
          subtitle="Chỉ chủ tài liệu hoặc role được cấp quyền mới thấy thao tác này."
          onClose={() => setEditDocument(null)}
        >
          <form onSubmit={handleSaveEdit} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <FieldLabel>Tên tài liệu</FieldLabel>
              <input
                value={editDocument.name}
                onChange={(event) =>
                  setEditDocument((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="docs-input"
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <FieldLabel>Thư mục</FieldLabel>
                <select
                  value={editDocument.folderId}
                  onChange={(event) =>
                    setEditDocument((current) => ({
                      ...current,
                      folderId: event.target.value,
                    }))
                  }
                  className="docs-input"
                >
                  {folders.map((folder) => (
                    <option key={folder._id || folder.id} value={folder._id || folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <FieldLabel>Nhóm tài liệu</FieldLabel>
                <select
                  value={editDocument.category || "general"}
                  onChange={(event) =>
                    setEditDocument((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="docs-input"
                >
                  {categoryOptions
                    .filter((option) => option.value !== "all")
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="grid gap-2">
              <FieldLabel>Mô tả</FieldLabel>
              <textarea
                value={editDocument.description || ""}
                onChange={(event) =>
                  setEditDocument((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                className="docs-input min-h-28 resize-none py-3"
              />
            </label>
            <label className="grid gap-2">
              <FieldLabel>Tags</FieldLabel>
              <input
                value={editDocument.tagsText || ""}
                onChange={(event) =>
                  setEditDocument((current) => ({
                    ...current,
                    tagsText: event.target.value,
                  }))
                }
                className="docs-input"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditDocument(null)}
                className="docs-secondary-button"
              >
                Hủy
              </button>
              <button type="submit" disabled={isSubmitting} className="docs-primary-button">
                <span className="material-symbols-outlined icon-fill">save</span>
                Lưu
              </button>
            </div>
          </form>
        </PortalModal>
      )}

      {versionDocument && (
        <PortalModal
          title="Upload phiên bản mới"
          subtitle={versionDocument.name}
          onClose={() => setVersionDocument(null)}
        >
          <form onSubmit={handleUploadVersion} className="mt-6 grid gap-4">
            <label className="docs-dropzone">
              <span className="material-symbols-outlined text-4xl text-violet-600">
                history
              </span>
              <span className="text-sm font-black text-slate-900">
                {versionFile?.name || "Chọn file thay thế"}
              </span>
              <span className="text-xs font-bold text-slate-500">
                Phiên bản mới sẽ trở thành bản hiện hành.
              </span>
              <input
                type="file"
                onChange={(event) => setVersionFile(event.target.files?.[0] || null)}
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVersionDocument(null)}
                className="docs-secondary-button"
              >
                Hủy
              </button>
              <button type="submit" disabled={isSubmitting} className="docs-primary-button">
                <span className="material-symbols-outlined icon-fill">upgrade</span>
                Upload phiên bản
              </button>
            </div>
          </form>
        </PortalModal>
      )}

      {shareTarget && (
        <PortalModal
          title="Chia sẻ tài liệu"
          subtitle={shareTarget.name}
          onClose={() => setShareTarget(null)}
        >
          <form onSubmit={handleCreateShare} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <FieldLabel>Phiên bản</FieldLabel>
                <select
                  value={shareForm.mode}
                  onChange={(event) =>
                    setShareForm((current) => ({ ...current, mode: event.target.value }))
                  }
                  className="docs-input"
                >
                  <option value="fixed_version">Giữ phiên bản hiện tại</option>
                  <option value="latest">Luôn dùng bản mới nhất</option>
                </select>
              </label>
              <label className="grid gap-2">
                <FieldLabel>Quyền link</FieldLabel>
                <select
                  value={shareForm.permission}
                  onChange={(event) =>
                    setShareForm((current) => ({
                      ...current,
                      permission: event.target.value,
                    }))
                  }
                  className="docs-input"
                >
                  <option value="view">Chỉ xem</option>
                  <option value="download">Cho phép tải</option>
                </select>
              </label>
              <label className="grid gap-2">
                <FieldLabel>Hết hạn</FieldLabel>
                <input
                  type="datetime-local"
                  value={shareForm.expiry}
                  onChange={(event) =>
                    setShareForm((current) => ({ ...current, expiry: event.target.value }))
                  }
                  className="docs-input"
                />
              </label>
              <label className="grid gap-2">
                <FieldLabel>Lượt tải tối đa</FieldLabel>
                <input
                  type="number"
                  min="1"
                  value={shareForm.maxDownloads}
                  onChange={(event) =>
                    setShareForm((current) => ({
                      ...current,
                      maxDownloads: event.target.value,
                    }))
                  }
                  className="docs-input"
                  placeholder="Không giới hạn"
                />
              </label>
            </div>
            {shareLink && (
              <div className="rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-900 ring-1 ring-cyan-100">
                {shareLink}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShareTarget(null)}
                className="docs-secondary-button"
              >
                Đóng
              </button>
              <button type="submit" disabled={isSubmitting} className="docs-primary-button">
                <span className="material-symbols-outlined icon-fill">link</span>
                Tạo và sao chép link
              </button>
            </div>
          </form>
        </PortalModal>
      )}

      {folderModalOpen && (
        <PortalModal
          title="Tạo thư mục tài liệu"
          subtitle="Thư mục mới sẽ hiển thị cho các thành viên trong tổ chức."
          onClose={() => setFolderModalOpen(false)}
        >
          <form onSubmit={handleCreateFolder} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <FieldLabel>Tên thư mục</FieldLabel>
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                className="docs-input"
                placeholder="Ví dụ: Quy trình nội bộ"
                required
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFolderModalOpen(false)}
                className="docs-secondary-button"
              >
                Hủy
              </button>
              <button type="submit" disabled={isSubmitting} className="docs-primary-button">
                <span className="material-symbols-outlined icon-fill">create_new_folder</span>
                Tạo thư mục
              </button>
            </div>
          </form>
        </PortalModal>
      )}
    </div>
  );
};

export default DocsPage;
