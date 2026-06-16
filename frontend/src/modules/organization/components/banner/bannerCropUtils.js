export const BANNER_CROP_ASPECT = 16 / 6;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const getInitialBannerCrop = (width, height) => {
  if (!width || !height) return null;

  const cropWidth = Math.min(width * 0.86, height * BANNER_CROP_ASPECT * 0.86);
  const cropHeight = cropWidth / BANNER_CROP_ASPECT;

  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
};

export const moveCropWithinBounds = (crop, nextX, nextY, bounds) => ({
  ...crop,
  x: clamp(nextX, 0, Math.max(0, bounds.width - crop.width)),
  y: clamp(nextY, 0, Math.max(0, bounds.height - crop.height)),
});

export const drawBannerCrop = ({ canvas, image, crop, outputWidth = 1600 }) => {
  if (!canvas || !image || !crop) return false;

  const outputHeight = Math.round(outputWidth / BANNER_CROP_ASPECT);
  const scaleX = image.naturalWidth / image.clientWidth;
  const scaleY = image.naturalHeight / image.clientHeight;
  const context = canvas.getContext("2d");

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  context.clearRect(0, 0, outputWidth, outputHeight);
  context.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return true;
};

export const createCroppedBannerFile = ({ image, crop, fileName = "banner" }) =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const drawn = drawBannerCrop({ canvas, image, crop });

    if (!drawn) {
      reject(new Error("Cannot crop banner image"));
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Cannot export banner image"));
          return;
        }

        const safeName = String(fileName || "organization-banner")
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/^-+|-+$/g, "");
        resolve(
          new File([blob], `${safeName || "organization-banner"}-cropped.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.92,
    );
  });
