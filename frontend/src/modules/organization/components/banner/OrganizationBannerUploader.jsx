import { useEffect, useRef, useState } from "react";
import { hasPermission } from "../../organizationUtils";
import Icon from "../Icon";
import BannerCropModal from "./BannerCropModal";

const OrganizationBannerUploader = ({ isSaving, onSave, organization }) => {
  const inputRef = useRef(null);
  const objectUrlRef = useRef("");
  const [selectedFile, setSelectedFile] = useState(null);
  const canUpdateBanner = hasPermission(organization, "manageOrganization");

  const revokeObjectUrl = () => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
  };

  useEffect(
    () => () => {
      if (!objectUrlRef.current) return;
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    },
    [],
  );

  const handlePickFile = () => {
    if (!canUpdateBanner || isSaving) return;
    inputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    revokeObjectUrl();
    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    setSelectedFile({ file, previewUrl });
  };

  const handleSave = async (file) => {
    const updated = await onSave?.(file);
    if (updated) {
      revokeObjectUrl();
      setSelectedFile(null);
    }
  };

  const handleClose = () => {
    revokeObjectUrl();
    setSelectedFile(null);
  };

  if (!canUpdateBanner) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        className="sr-only"
      />
      <button
        type="button"
        onClick={handlePickFile}
        disabled={isSaving}
        className="organization-hero-banner-button group absolute inset-0 overflow-hidden rounded-[1.75rem] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
        aria-label="Thay đổi ảnh biểu ngữ"
      >
        <span className="organization-hero-banner-button-label inline-flex items-center gap-2 rounded-2xl bg-slate-950/72 px-4 py-2 text-sm font-black shadow-xl shadow-slate-950/20 backdrop-blur-md transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <Icon name={isSaving ? "hourglass_top" : "wallpaper"} />
          {isSaving ? "Đang cập nhật..." : "Thay đổi ảnh biểu ngữ"}
        </span>
      </button>
      <BannerCropModal
        key={selectedFile?.previewUrl}
        file={selectedFile?.file}
        imageUrl={selectedFile?.previewUrl}
        isSaving={isSaving}
        onClose={handleClose}
        onSave={handleSave}
        open={Boolean(selectedFile)}
      />
    </>
  );
};

export default OrganizationBannerUploader;
