//@ts-check
const download = require("./js/download");
const analyze = require("./js/analyze");
const images = require("./js/images");
const html = require("./js/html");

const story_list = [
  { folder_name: "ficlive_scripting", node_id: "pJSFhShedzWhiaXQN", include_polls: true, include_writeins: true },
];

(async () => {
  for (const story of story_list) {
    await download.retrieve_ficlive_data(story.folder_name, story.node_id, {
      show_output: true,
    });
    await analyze.analyze_story_data(story.folder_name, {
      show_output: true,
      include_polls: story.include_polls,
      include_writeins: story.include_writeins,
    });
    await images.transform_images_of_analyzed_data(story.folder_name, {
      show_output: true,
    });
    await html.generate_html_for_story_data(story.folder_name, {
      show_output: true,
    });
    await images.download_images(story.folder_name, { show_output: true });
  }
})();
