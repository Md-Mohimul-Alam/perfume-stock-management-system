// backend/src/utils/imgbb.js

const axios = require("axios");
const FormData = require("form-data");

const uploadToImgBB = async (fileBuffer, fileName) => {
  if (!process.env.IMGBB_API_KEY) {
    throw new Error("IMGBB_API_KEY is not configured");
  }

  const form = new FormData();

  form.append("image", fileBuffer.toString("base64"));
  form.append("name", fileName);

  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    }
  );

  if (!response.data?.success) {
    throw new Error("ImgBB upload failed");
  }

  return {
    url: response.data.data.url,
    displayUrl: response.data.data.display_url,
    viewerUrl: response.data.data.url_viewer,
    deleteUrl: response.data.data.delete_url,
  };
};

module.exports = uploadToImgBB;