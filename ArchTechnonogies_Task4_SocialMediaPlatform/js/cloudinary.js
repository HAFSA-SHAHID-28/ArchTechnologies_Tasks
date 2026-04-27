import { validateImageFile } from "./ui.js";

const cloudinaryConfig = {
  cloudName: "dzakombpw",
  uploadPreset: "socialMediaPlatform"
};

function hasPlaceholder(value) {
  return typeof value === "string" && value.startsWith("PASTE_");
}

export function ensureCloudinaryConfigured() {
  if (hasPlaceholder(cloudinaryConfig.cloudName) || hasPlaceholder(cloudinaryConfig.uploadPreset)) {
    throw new Error("Cloudinary config missing. Open js/cloudinary.js and paste your cloud name and unsigned upload preset.");
  }
}

export async function uploadImageToCloudinary(file, folder) {
  if (!file) {
    return "";
  }

  validateImageFile(file);
  ensureCloudinaryConfigured();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);
  formData.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });

  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    throw new Error(result?.error?.message || "Image upload failed. Please check Cloudinary setup.");
  }

  return result.secure_url;
}
