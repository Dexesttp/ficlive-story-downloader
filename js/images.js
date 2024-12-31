//@ts-check
const utils = require("./utils");

const generic_image_matcher = /<img src="([^"]*)"/g;
const filepicker_url_matcher =
  /https:\/\/www\.filepicker\.io\/api\/file\/([a-zA-z0-9]*)/;
const cloudfront_file_picker =
  /https:\/\/[a-z0-9]*\.cloudfront\.net\/images\/([a-zA-z0-9._-]*)/;
const cdn_url_matcher =
  /https:\/\/cdn\d\.fiction\.live\/images\/([a-zA-z0-9._-]*)/;

/**
 * Re-generate the analyzed data including image associations for the data
 * @param {string} folder_name The short name of the story to transform (used for file and directory names)
 * @param {{ show_output?: boolean }} [options] The options to use
 */
module.exports.transform_images_of_analyzed_data = async function (
  folder_name,
  options
) {
  options = options || { show_output: false };

  await utils.ensure_directory(utils.paths.images);
  /** @type {utils.ImageData[]} */
  let existingImages = [];
  if (
    await utils.check_if_file_exists(
      `${utils.paths.images}/${folder_name}.json`
    )
  ) {
    /** @type {utils.StoryDataWithImages} */
    const old_story = await utils.read_json_file(
      `${utils.paths.images}/${folder_name}.json`
    );
    existingImages = old_story.images;
  }

  /** @type {utils.StoryData} */
  const anayzed_data = await utils.read_json_file(
    `${utils.paths.analyze}/${folder_name}.json`
  );

  /** @type {utils.StoryDataWithImages} */
  const story = {
    title: anayzed_data.title,
    chapters: [],
    images: [],
  };

  for (const chapter of anayzed_data.chapters) {
    const new_fragments = [];
    for (const fragment of chapter.fragments) {
      new_fragments.push(
        fragment.replace(generic_image_matcher, (match, content1) => {
          let url = content1;

          let extension = ".png";
          const last_dot_index = url.lastIndexOf(".");
          if (last_dot_index >= url.length - 6) {
            extension = url.substring(last_dot_index);
          }

          const filepicker_data = filepicker_url_matcher.exec(url);
          if (filepicker_data)
            url = `https://cdn6.fiction.live/file/fictionlive/fp/${filepicker_data[1]}`;
          const cloudfront_data = cloudfront_file_picker.exec(url);
          if (cloudfront_data)
            url = `https://cdn6.fiction.live/file/fictionlive/images/${cloudfront_data[1]}`;
          const cdn_data = cdn_url_matcher.exec(url);
          if (cdn_data)
            url = `https://cdn6.fiction.live/file/fictionlive/images/${cdn_data[1]}`;

          const existing_image = story.images.find(
            (i) => i.original_urls?.includes(content1) || i.url === url
          );
          if (existing_image) {
            if (options.show_output)
              console.log(
                `Found image ${utils.paths.output}/${folder_name}/images/${existing_image.new_name} for URL ${url}`
              );
            existing_image.original_urls.push(content1);
            return `<img src="images/${existing_image.new_name}"`;
          }

          const old_image = existingImages.find(
            (i) =>
              i.original_urls?.includes(content1) ||
              i.url === url ||
              i.url === content1
          );
          if (old_image) {
            if (options.show_output)
              console.log(
                `Found image ${utils.paths.output}/${folder_name}/images/${old_image.new_name} for URL ${url}`
              );
            story.images.push({
              original_urls: [content1],
              new_name: old_image.new_name,
              url: url,
            });
            return `<img src="images/${old_image.new_name}"`;
          }

          const new_image_name = `${utils.generate_guid()}${extension}`;
          story.images.push({
            original_urls: [content1],
            new_name: new_image_name,
            url: url,
          });
          if (options.show_output)
            console.log(
              `Replacing ${content1} with ${utils.paths.output}/${folder_name}/images/${new_image_name}`
            );
          return `<img src="images/${new_image_name}"`;
        })
      );
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

  await utils.delete_file_if_exists(
    `${utils.paths.images}/${folder_name}.json`
  );
  await utils.write_json_file(
    `${utils.paths.images}/${folder_name}.json`,
    story
  );
};

/**
 * Re-generate the analyzed data including image associations for the data
 * @param {string} folder_name The short name of the story to transform (used for file and directory names)
 * @param {{ show_output?: boolean, force_download_images?: boolean }} [options] The options to use
 */
module.exports.download_images = async function (folder_name, options) {
  options = options || { show_output: false };

  /** @type {utils.StoryDataWithImages} */
  const story_data = await utils.read_json_file(
    `${utils.paths.images}/${folder_name}.json`
  );

  const output_directory_path = `${utils.paths.output}/${folder_name}`;
  if (story_data.images) {
    const image_directory = `${output_directory_path}/images`;
    await utils.ensure_directory(image_directory);
    for (const image_data of story_data.images) {
      if (!options.force_download_images) {
        const exists = await utils.check_if_file_exists(
          `${image_directory}/${image_data.new_name}`
        );
        if (exists) {
          const contents = await utils.read_raw_file(
            `${image_directory}/${image_data.new_name}`
          );
          if (contents.length > 24) {
            console.log(
              `Image ${image_directory}/${image_data.new_name} already downloaded (${contents.length} bytes)`
            );
            continue;
          } else {
            console.log(
              `Image ${image_directory}/${image_data.new_name} was only ${contents.length} bytes - redownloading...`
            );
          }
        }
      }
      if (options.show_output)
        console.log(
          `Downloading ${image_data.url} to ${image_directory}/${image_data.new_name}`
        );
      try {
        await utils.download_raw_data_to_file(
          image_data.url,
          `${image_directory}/${image_data.new_name}`
        );
      } catch (e) {
        console.log(
          `!!! Could not download ${image_directory}/${image_data.new_name} :`,
          e
        );
        // NO OP
      }
      await utils.wait_for_timeout(2000, 1000);
    }
  }
};
