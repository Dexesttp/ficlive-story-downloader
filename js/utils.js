//@ts-check
const fs = require("fs");
const https = require("https");

/**
 * Define the type of things that we retrieve from fiction.live
 * @typedef {{ t?: string, bm?: NodeChapterData[] }} NodeData
 * @typedef {{ title?: string, id?: string, ct?: number, is_first?: boolean }} NodeChapterData
 * @typedef {{ nt: "chapter", t?: string, "b": string }} NodeTypeChapter
 * @typedef {{ nt: "chat", t?: string }} NodeTypeChat
 * @typedef {{ nt: "choice", t?: string, choices: string[], xOut?: string[] } & ({ multiple: true, votes?: { [id: string]: number[] }, userVotes?: { [id: string]: number[] } } | { multiple: false, votes?: { [id: string]: number }, userVotes?: { [id: string]: number } })} NodeTypeChoice
 * @typedef {{ nt: "readerPost", t?: string, votes?: { [id: string]: string } }} NodeTypeReaderPost
 * @typedef {{ nt: "story", t?: string }} NodeTypeStory
 * @typedef {NodeTypeChapter | NodeTypeChat | NodeTypeChoice | NodeTypeReaderPost | NodeTypeStory} AnyNodeType
 * @typedef {AnyNodeType[]} NodeChapterDataList
 */

/**
 * Define the type of things that we store as intermediate data
 * @typedef {{ title: string, raw_file_name: string, output_file_name: string, is_appendix: boolean }} ChapterMetadata
 * @typedef {{ title: string, chapter_metadata: ChapterMetadata[] }} StoryMetadata
 * @typedef {{ title: string, is_appendix: boolean, raw_file_name: string, output_file_name: string, previous_file: string, next_file: string, fragments: string[] }} ChapterData
 * @typedef {{ title: string, chapters: ChapterData[] }} StoryData
 * @typedef {{ url: string, new_name: string }} ImageData
 * @typedef {{ title: string, chapters: ChapterData[], images: ImageData[] }} StoryDataWithImages
 */

/**
 * Define the different paths to use for the different conversion steps
 */
module.exports.paths = {
  /** The folder for the raw downloaded data from fiction.live */
  download: "raw/download",
  /** The folder for the analyzed data */
  analyze: "raw/analyze",
  /** The folder for the analyzed data with images preprocessing */
  images: "raw/images",
  /** The folder for the output data */
  output: "stories",
};

/**
 * Wait the given number of milliseconds
 * @param {number} milliseconds The default number of milliseconds to randomly wait for
 * @param {number} [jitter_millseconds] The max number of milliseconds to wait on top of the default number. The actual wait will be random between this value and the max
 * @returns {Promise<void>} A promise that gets resolved when the timeout is over
 */
module.exports.wait_for_timeout = function (milliseconds, jitter_millseconds) {
  jitter_millseconds = jitter_millseconds || 0;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliseconds + Math.floor(Math.random() * jitter_millseconds));
  });
};

/**
 * Checks if the given file exists
 * @param {string} file_name The path of the file to check
 * @returns {Promise<boolean>} A promise of whether the file exists and is accessible for read/write
 */
module.exports.check_if_file_exists = function (file_name) {
  return new Promise((resolve) => {
    fs.access(file_name, fs.constants.R_OK | fs.constants.W_OK, (err) => {
      if (!!err) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
};

/**
 * Deletes the given file if it exists
 * @param {string} file_name The path of the file to delete
 * @returns {Promise<void>} A promise of the completion of the optional deletion
 */
module.exports.delete_file_if_exists = function (file_name) {
  return new Promise((resolve, reject) => {
    fs.access(file_name, fs.constants.R_OK | fs.constants.W_OK, (err) => {
      if (!!err) {
        resolve();
        return;
      }
      fs.unlink(file_name, (err) => {
        if (!!err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });
};

/**
 * Read a raw file from a given path
 * @param {string} file_name The path of the file to download
 * @returns {Promise<Buffer>} The content of the raw file
 */
module.exports.read_raw_file = function (file_name) {
  return new Promise((resolve, reject) => {
    fs.readFile(file_name, (err, data) => {
      if (!!err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
};

/**
 * Read a JSON file from a given path
 * @param {string} file_name The path of the file to download
 * @returns {Promise<any>} The content of the JSON file
 */
module.exports.read_json_file = function (file_name) {
  return new Promise((resolve, reject) => {
    fs.readFile(file_name, (err, data) => {
      if (!!err) {
        reject(err);
        return;
      }
      resolve(JSON.parse(data.toString()));
    });
  });
};

/**
 * Writes some raw data into a file
 * @param {string} file_name The name of the file to write to
 * @param {string} text The text to store into the file
 * @returns {Promise<void>} A promise that resolves when the data gets written
 */
module.exports.write_raw_file = function (file_name, text) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file_name, text, {}, (err) => {
      if (!!err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};
/**
 * Writes some JSON data into a file
 * @param {string} file_name The name of the file to write to
 * @param {any} data The JSON data to store into the file
 * @returns {Promise<void>} A promise that resolves when the data gets written
 */
module.exports.write_json_file = async function (file_name, data) {
  await module.exports.write_raw_file(file_name, JSON.stringify(data, null, 2));
};

/**
 * Ensures that the given directory exists
 * @param {string} path The directory path
 * @returns {Promise<void>} A promise that resolves when the directory is created
 */
module.exports.ensure_directory = function (path) {
  return new Promise((resolve, reject) => {
    fs.access(path, fs.constants.W_OK | fs.constants.R_OK, (err) => {
      if (err) {
        fs.mkdir(path, { recursive: true }, (err, _path) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
        return;
      }
      resolve();
    });
  });
};

/**
 * Delete the given directory if it exists
 * @param {string} directory_path The path of the directory to delete
 * @returns {Promise<void>} A promise of the completion of the optional deletion
 */
module.exports.delete_directory_if_exists = function (directory_path) {
  return new Promise((resolve, reject) => {
    fs.access(directory_path, fs.constants.R_OK | fs.constants.W_OK, (err) => {
      if (!!err) {
        resolve();
        return;
      }
      fs.rm(directory_path, { recursive: true, force: true }, (err) => {
        if (!!err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });
};

/**
 * Download some raw data from a HTTPS url
 * @param {string} url The URL to read
 * @param {string} file_path The path of the file to store the data into
 * @returns {Promise<void>} A promise that gets completed when the download finishes
 */
module.exports.download_raw_data_to_file = function (url, file_path) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(file_path);
    const request = https.get(url, (res) => {
      if (!res) {
        reject();
        return;
      }

      res.pipe(file);
      file.on("finish", (e) => {
        file.close();
        resolve();
      });
    });
    request.on("error", (e) => {
      fs.unlink(file_path, () => {
        /* Ignored */
      });
      reject(e);
    });
  });
};

/**
 * Download some JSON data from a HTTPS url
 * @param {string} url The URL to read
 * @returns {Promise<any>} A promise of the downloaded JSON data
 */
module.exports.download_json_data = function (url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (!res) {
        reject();
        return;
      }

      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      res.on("error", (e) => {
        reject(e);
      });
    });
  });
};

module.exports.generate_guid = function () {
  function replacement_method(character) {
    var r = (Math.random() * 16) | 0,
      v = character == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    replacement_method
  );
};
