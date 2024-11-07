import { promises as fs } from "fs";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Constants for allowed MIME types
const ALLOWED_MIME_TYPES = {
  images: ["image/jpeg", "image/jpg", "image/png", "image/gif"],
  videos: ["video/mp4", "video/mpeg", "video/ogg", "video/webm", "video/avi"],
  pdfs: ["application/pdf"],
  all: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "video/mp4",
    "video/mpeg",
    "video/ogg",
    "video/webm",
    "video/avi",
    "application/pdf",
  ],
};

/**
 * Function to configure storage for Multer.
 *
 * @param {string} destination - The destination folder where files will be stored. Default is "uploads".
 * @returns {object} - Multer storage configuration object.
 */
const configureStorage = (destination) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination || "uploads"); // Default folder is "uploads" if none is provided.
    },
    filename: (req, file, cb) => {
      const sanitizedFilename = file.originalname.replace(/\\/g, "/");
      const extension = path.extname(sanitizedFilename);
      const fieldName = file.fieldname || "file"; // Use the field name as part of the filename.
      const uniqueName = uuidv4(); // Generate a unique name using uuid.
      let fileName = `${uniqueName}-${fieldName}${extension}`;

      // Replace backslashes with forward slashes in the final filename
      fileName = fileName.replace(/\\/g, "/");

      cb(null, fileName); // Set the final filename.
    },
  });
};

/**
 * Function to configure file filter for Multer.
 *
 * @param {Array} allowedMimeTypes - Array of allowed MIME types.
 * @returns {function} - File filter function for Multer.
 */
const configureFileFilter = (allowedMimeTypes) => {
  return (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Allow the file if its MIME type is allowed.
    } else {
      cb(
        new Error("Invalid file type. Only specified file types are allowed."),
        false
      ); // Reject the file if its MIME type is not allowed.
    }
  };
};

/**
 * Function to configure Multer with the provided options.
 *
 * @param {object} options - Configuration options for Multer.
 * @param {string} [options.destination] - Destination folder for files. Default is "uploads".
 * @param {string} [options.filename] - Custom filename template for saved files.
 * @param {Array<string>} [options.fileTypes] - Array of file types to allow (e.g., ['images', 'videos']).
 * @param {Array<string>} [options.customMimeTypes] - Array of custom MIME types to allow.
 * @param {number} [options.fileSizeLimit] - Maximum file size allowed (in bytes). Default is 50MB.
 * @param {boolean} [options.preservePath] - Preserve the full path of files. Default is false.
 * @returns {object} - Multer instance configured with the provided options.
 */
const configureMulter = ({
  destination,
  filename,
  fileTypes = [],
  customMimeTypes = [],
  fileSizeLimit,
  preservePath = false,
}) => {
  const storage = configureStorage(destination);

  // Combine allowed MIME types based on fileTypes array
  let allowedMimeTypes = [];

  if (customMimeTypes.length > 0) {
    // Use custom MIME types if provided
    allowedMimeTypes = customMimeTypes;
  } else {
    // Use default MIME types for specified fileTypes
    fileTypes.forEach((type) => {
      if (ALLOWED_MIME_TYPES[type]) {
        allowedMimeTypes = allowedMimeTypes.concat(ALLOWED_MIME_TYPES[type]);
      }
    });

    // If no specific file types are provided, use all allowed MIME types
    if (allowedMimeTypes.length === 0) {
      allowedMimeTypes = ALLOWED_MIME_TYPES.all;
    }
  }

  const fileFilter = configureFileFilter(allowedMimeTypes);

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: fileSizeLimit || 1024 * 1024 * 50 }, // Default 50MB file size limit
    preservePath,
  });
};

/**
 * Function to handle multiple fields in a single form submission.
 *
 * @param {Array} fields - Array of field configurations, each containing:
 *   @param {string} fields.name - The name of the form field.
 *   @param {number} [fields.maxCount=10] - The maximum number of files to accept per field.
 *   @param {Array<string>} [fields.fileTypes] - Array of file types to allow for this field (e.g., ['images']).
 * @returns {function} - Multer instance configured to handle multiple fields.
 */
const uploadFields = (fields) => {
  const fieldConfigs = fields.map((field) => ({
    name: field.name,
    maxCount: field.maxCount || 10, // Default maxCount is 10 if not specified.
  }));

  let allowedFileTypes = [];

  fields.forEach((field) => {
    const types = field.fileTypes || [];
    types.forEach((type) => {
      if (ALLOWED_MIME_TYPES[type]) {
        allowedFileTypes = allowedFileTypes.concat(ALLOWED_MIME_TYPES[type]);
      }
    });
  });

  const multerInstance = configureMulter({
    fileTypes: allowedFileTypes,
    customMimeTypes: [],
    fileSizeLimit: fields[0]?.fileSizeLimit, // Assuming all fields share the same limit.
  });

  return multerInstance.fields(fieldConfigs);
};

// Export functions to configure multer and available file types
export const uploadSingle = (options = {}) => {
  const multerInstance = configureMulter(options);
  return multerInstance.single(options.filename || "file");
};

export const uploadMultiple = (options = {}) => {
  const multerInstance = configureMulter(options);
  return multerInstance.fields(options.fields || []);
};

export const ALLOWED_FILE_TYPES = Object.keys(ALLOWED_MIME_TYPES);

export const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting file: ${error.message}`);
    return false;
  }
};
