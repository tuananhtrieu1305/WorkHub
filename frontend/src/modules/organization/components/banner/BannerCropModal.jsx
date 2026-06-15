import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import {
  createCroppedBannerFile,
  drawBannerCrop,
  getInitialBannerCrop,
  moveCropWithinBounds,
} from "./bannerCropUtils";

const BannerCropModal = ({ file, imageUrl, isSaving, onClose, onSave, open }) => {
  const [crop, setCrop] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef(null);
  const stageRef = useRef(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);

  const resetCrop = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;

    setCrop(getInitialBannerCrop(image.clientWidth, image.clientHeight));
  }, []);

  const refreshPreview = useCallback(() => {
    if (!crop) return;
    drawBannerCrop({
      canvas: previewRef.current,
      crop,
      image: imageRef.current,
      outputWidth: 480,
    });
  }, [crop]);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  const handleImageLoad = () => {
    requestAnimationFrame(resetCrop);
  };

  const handlePointerDown = (event) => {
    if (!crop || !imageRef.current) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cropX: crop.x,
      cropY: crop.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId || !crop) {
      return;
    }

    const image = imageRef.current;
    if (!image) return;
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    setCrop(
      moveCropWithinBounds(
        crop,
        dragRef.current.cropX + deltaX,
        dragRef.current.cropY + deltaY,
        {
          width: image.clientWidth,
          height: image.clientHeight,
        },
      ),
    );
  };

  const handlePointerUp = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleSave = async () => {
    if (!imageRef.current || !crop || isSaving) return;

    const croppedFile = await createCroppedBannerFile({
      crop,
      fileName: file?.name,
      image: imageRef.current,
    });
    await onSave(croppedFile);
  };

  if (!open || !file || !imageUrl) return null;

  const modal = (
    <div className="organization-modal-backdrop fixed inset-0 z-[1000] grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <section className="organization-modal-card grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl ring-1 ring-white/80">
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase text-blue-600">
              ảnh biểu ngữ
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Căn chỉnh vùng hiển thị
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_18rem]">
          <div className="rounded-[1.5rem] bg-slate-950 p-4">
            <div
              ref={stageRef}
              className="organization-banner-crop-stage relative mx-auto w-fit overflow-hidden rounded-2xl"
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Ảnh biểu ngữ cần cắt"
                onLoad={handleImageLoad}
                className="block max-h-[56vh] max-w-full select-none object-contain"
                draggable={false}
              />
              {crop && (
                <>
                  <div className="organization-banner-crop-dim" aria-hidden="true" />
                  <button
                    type="button"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={`organization-banner-crop-box ${
                      isDragging ? "is-dragging" : ""
                    }`}
                    style={{
                      height: crop.height,
                      left: crop.x,
                      top: crop.y,
                      width: crop.width,
                    }}
                    aria-label="Di chuyển khung crop ảnh biểu ngữ"
                  >
                    <span className="organization-banner-crop-grip">
                      <Icon name="open_with" className="text-base leading-none" />
                      Kéo để căn ảnh
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <div>
              <p className="text-sm font-black text-slate-950">Preview</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                Đây là vùng ảnh sẽ được dùng làm biểu ngữ sau khi lưu.
              </p>
            </div>
            <canvas
              ref={previewRef}
              className="h-auto w-full rounded-2xl bg-slate-100 ring-1 ring-slate-200"
            />
            <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
              <p>Khung crop giữ tỉ lệ rộng để ảnh không bị méo trên header.</p>
              <p>Kéo khung sáng để chọn vùng hiển thị đẹp nhất.</p>
            </div>
          </aside>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={resetCrop}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Icon name="restart_alt" />
            Đặt lại
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!crop || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 active:translate-y-0 disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
          >
            <Icon name={isSaving ? "hourglass_top" : "check"} />
            {isSaving ? "Đang lưu..." : "Lưu ảnh biểu ngữ"}
          </button>
        </footer>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
};

export default BannerCropModal;
