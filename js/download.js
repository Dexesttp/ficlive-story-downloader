//@ts-check
const utils = require("./utils");

/**
 * Get some JSON data from a file, or download it from an URL if the file doesn't exist then create the file.
 * @param {string} file_name Name of the file where to store the JSON.
 * @param {string} url The URL to download the data from.
 * @returns {Promise<any>} A promise of the downloaded or cached JSON data
 */
async function get_json_data_or_download(file_name, url) {
  try {
    return await utils.read_json_file(file_name);
  } catch (_) {
    const data = await utils.download_json_data(url);
    await utils.write_json_file(file_name, data);
    await utils.wait_for_timeout(2000, 1000);
    return data;
  }
}

/**
 * Resolves a node ID to a fiction.live API URL
 * @param {string} node_id The node ID to resolve to an URL
 * @returns The API URL of the node
 */
function node_url_from_id(node_id) {
  return `https://fiction.live/api/node/${node_id}`;
}

/**
 * Resolves a chapter's node data to a fiction.live API URL
 * @param {string} node_id The node ID of the story
 * @param {utils.NodeChapterData} bm The chapter data from the node's data
 * @param {utils.NodeChapterData | undefined} next_bm The nexxt chapter's data from the node data, or `undefined` if there is no next chapter
 * @returns The API URL of the chapter
 */
function content_url_from_bm(node_id, bm, next_bm) {
  let next_timestamp = 999999999999998;
  if (bm.title?.startsWith("#special")) {
    // "Special" (read: at-the-end) chapters are not handled as usual, and we only need one "entry" for them.
    next_timestamp = (bm.ct ?? 0) + 1;
  } else if (next_bm) {
    next_timestamp = (next_bm.ct ?? 0) - 1;
  }
  return `https://fiction.live/api/anonkun/chapters/${node_id}/${bm.ct}/${next_timestamp}`;
}

/**
 * Download the data for a story from fiction.live
 * @param {string} folder_name The short name of the story to download (used for filenames and such)
 * @param {string} node_id The "node ID" of the story as stored on fiction.live
 * @param {{ show_output?: boolean, force_download_latest?: boolean, force_download_special?: boolean }} [options] The options
 */
module.exports.retrieve_ficlive_data = async function (
  folder_name,
  node_id,
  options
) {
  options = options || { show_output: false };
  const story_directory_path = `${utils.paths.download}/${folder_name}`;
  await utils.ensure_directory(story_directory_path);
  const node_filename = `${story_directory_path}/node.json`;
  let will_download_node_file = false;
  if (options.force_download_latest) {
    await utils.delete_file_if_exists(node_filename);
    will_download_node_file = true;
  } else if (!(await utils.check_if_file_exists(node_filename))) {
    will_download_node_file = true;
  }
  if (options.show_output) {
    const url = node_url_from_id(node_id);
    const dl_status = will_download_node_file ? "(downloading)" : "";
    console.log(`${folder_name} - [[[Node data]]] - ${url} ${dl_status}`);
  }
  /** @type {utils.NodeData} */
  const data = await get_json_data_or_download(
    node_filename,
    node_url_from_id(node_id)
  );
  if (!data.bm) {
    console.log(
      `Could not find chapter list for ${folder_name} in the node data!`
    );
    return;
  }
  /** @type {Array<{ bm: utils.NodeChapterData, index: number, filename: string, is_cached: boolean, is_special_chapter: boolean }>} */
  const all_bm_data = [];
  for (let index = 0; index < data.bm.length; ++index) {
    const bm = data.bm[index];
    const filename = `${story_directory_path}/chapter_${bm.id}.json`;
    all_bm_data.push({
      bm,
      index,
      filename,
      is_cached: await utils.check_if_file_exists(filename),
      is_special_chapter: bm.title?.startsWith("#special") ?? false,
    });
  }
  for (const bm_data of all_bm_data) {
    const bm = bm_data.bm;
    const next_bm_data = all_bm_data.find(
      (d) => !d.is_special_chapter && d.index > bm_data.index
    );
    const next_bm = next_bm_data?.bm;
    let expect_redownload = false;
    if (
      bm_data.is_cached &&
      !bm_data.is_special_chapter &&
      !next_bm_data?.is_cached &&
      options.force_download_latest
    ) {
      await utils.delete_file_if_exists(bm_data.filename);
      expect_redownload = true;
    }
    if (
      bm_data.is_cached &&
      bm_data.is_special_chapter &&
      options.force_download_special
    ) {
      await utils.delete_file_if_exists(bm_data.filename);
      expect_redownload = true;
    }
    if (!bm_data.is_cached) {
      expect_redownload = true;
    }
    if (options.show_output) {
      const url = content_url_from_bm(node_id, bm, next_bm);
      const dl_status = expect_redownload ? "(downloading)" : "";
      console.log(`${folder_name} - ${bm.title} - ${url} ${dl_status}`);
    }
    await get_json_data_or_download(
      bm_data.filename,
      content_url_from_bm(node_id, bm, next_bm)
    );
  }
};
