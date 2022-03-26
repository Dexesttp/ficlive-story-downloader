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
  }
  catch (_) {
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
  if (bm.title.startsWith("#special")) {
    // "Special" (read: at-the-end) chapters are not handled as usual, and we only need one "entry" for them.
    next_timestamp = bm.ct + 1;
  } else if (next_bm) {
    next_timestamp = next_bm.ct - 1;
  }
  return `https://fiction.live/api/anonkun/chapters/${node_id}/${bm.ct}/${next_timestamp}`;
}

/**
 * Download the data for a story from fiction.live
 * @param {string} folder_name The short name of the story to download (used for filenames and such)
 * @param {string} node_id The "node ID" of the story as stored on fiction.live
 * @param {{ show_output?: boolean }} [options] The options
 */
module.exports.retrieve_ficlive_data = async function (folder_name, node_id, options) {
  options = options || { show_output: false };
  const story_directory_path = `${utils.paths.download}/${folder_name}`;
  await utils.ensure_directory(story_directory_path);
  if (options.show_output)
    console.log(`${folder_name} - [[[Node data]]] - ${node_url_from_id(node_id)}`)
  /** @type {utils.NodeData} */
  const data = await get_json_data_or_download(`${story_directory_path}/node.json`, node_url_from_id(node_id));
  if (!data.bm) {
    console.log(`Could not find chapter list for ${folder_name} in the node data!`);
    return;
  }
  for (let i = 0; i < data.bm.length; ++i) {
    const bm = data.bm[i];
    const next_bm = data.bm.find((d, ii) => ii > i && !d.title.startsWith("#special"));
    if (options.show_output)
      console.log(`${folder_name} - ${bm.title} - ${content_url_from_bm(node_id, bm, next_bm)}`);
    await get_json_data_or_download(`${story_directory_path}/chapter_${bm.id}.json`, content_url_from_bm(node_id, bm, next_bm));
  }
}
