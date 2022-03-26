//@ts-check
const download = require("./js/download");
const analyze = require("./js/analyze");
const images = require("./js/images");
const html = require("./js/html");

const story_list = [
  { folder_name: "ficlive_scripting", node_id: "pJSFhShedzWhiaXQN", include_polls: true, include_writeins: true },
];

(async () => {
  const option = { show_output: true };
  for (const story of story_list) {
    const folder_name = story.folder_name;
    const node_id = story.node_id;
    await download.retrieve_ficlive_data(folder_name, node_id, option);
    await analyze.analyze_story_data(
      folder_name,
      {
        include_polls: story.include_polls,
        include_writeins: story.include_writeins,
      },
      option
    );
    await images.transform_images_of_analyzed_data(folder_name, option);
    await html.generate_html_for_story_data(folder_name, option);
    await images.download_images(folder_name, option);
  }
})();
