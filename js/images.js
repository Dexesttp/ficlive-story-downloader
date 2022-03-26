//@ts-check
const utils = require("./utils");

const generic_image_matcher = /<img src="([^"]*)"/g;
const filepicker_url_matcher = /https:\/\/www\.filepicker\.io\/api\/file\/([a-zA-z0-9]*)/;

/**
 * Re-generate the analyzed data including image associations for the data
 * @param {string} folder_name The short name of the story to transform (used for file and directory names)
 * @param {{ show_output: boolean }} [options] The options to use
 */
module.exports.transform_images_of_analyzed_data = async function (folder_name, options) {
  options = options || { show_output: false };

  await utils.ensure_directory(utils.paths.images);
  /** @type {utils.ImageData[]} */
  let images = [];
  if (await utils.check_if_file_exists(`${utils.paths.images}/${folder_name}.json`)) {
    /** @type {utils.StoryDataWithImages} */
    const old_story = await utils.read_json_file(`${utils.paths.images}/${folder_name}.json`);
    images = old_story.images;
  }

  /** @type {utils.StoryData} */
  const anayzed_data = await utils.read_json_file(`${utils.paths.analyze}/${folder_name}.json`);

  /** @type {utils.StoryDataWithImages} */
  const story = {
    title: anayzed_data.title,
    chapters: [],
    images: images,
  };

  for (const chapter of anayzed_data.chapters) {
    const new_fragments = [];
    for (const fragment of chapter.fragments) {
      new_fragments.push(fragment.replace(generic_image_matcher, (match, content1) => {
        let url = content1;

        let extension = ".png";
        const last_dot_index = url.lastIndexOf(".");
        if (last_dot_index >= url.length - 6) {
          extension = url.substring(last_dot_index);
        }

        const filepicker_data = filepicker_url_matcher.exec(url);
        if (filepicker_data)
          url = `https://cdn4.fiction.live/fp/${filepicker_data[1]}?height=600&width=800&quality=95`;

        const matched_image = story.images.find(i => i.url === url);
        if (matched_image) {
          if (options.show_output)
            console.log(`Found image ${matched_image.new_name} for URL ${url}`);
          return `<img src="images/${matched_image.new_name}"`;
        }

        const new_image_name = `${utils.generate_guid()}${extension}`;
        story.images.push({
          new_name: new_image_name,
          url: url,
        });
        if (options.show_output)
          console.log(`Replacing ${content1} with ${new_image_name}`);
        return `<img src="images/${new_image_name}"`;
      }));
    }
    story.chapters.push({
      title: chapter.title,
      is_appendix: chapter.is_appendix,
      raw_file_name: chapter.raw_file_name,
      output_file_name: chapter.output_file_name,
      previous_file: chapter.previous_file,
      next_file: chapter.next_file,
      fragments: new_fragments,
    });
  }

  await utils.delete_file_if_exists(`${utils.paths.images}/${folder_name}.json`);
  await utils.write_json_file(`${utils.paths.images}/${folder_name}.json`, story);
}

/**
 * Re-generate the analyzed data including image associations for the data
 * @param {string} folder_name The short name of the story to transform (used for file and directory names)
 * @param {{ show_output: boolean }} [options] The options to use
 */
module.exports.download_images = async function (folder_name, options) {
  options = options || { show_output: false };

  /** @type {utils.StoryDataWithImages} */
  const story_data = await utils.read_json_file(`${utils.paths.images}/${folder_name}.json`);

  const output_directory_path = `${utils.paths.output}/${folder_name}`;
  if (story_data.images) {
    const image_directory = `${output_directory_path}/images`;
    await utils.ensure_directory(image_directory);
    for (const image_data of story_data.images) {
      if (await utils.check_if_file_exists(`${image_directory}/${image_data.new_name}`)) {
        console.log(`Image ${image_directory}/${image_data.new_name} already downloaded`);
        continue;
      }
      if (options.show_output)
        console.log(`Downloading ${image_data.url} to ${image_directory}/${image_data.new_name}`);
      await utils.download_raw_data_to_file(image_data.url, `${image_directory}/${image_data.new_name}`);
      await utils.wait_for_timeout(2000, 1000);
    }
  }
}