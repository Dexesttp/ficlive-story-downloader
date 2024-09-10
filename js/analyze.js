//@ts-check
const utils = require("./utils");

/**
 *
 * @param {utils.NodeData} node_data The node data to generate the chapter metadata from
 * @returns {utils.StoryMetadata} the story metadata
 */
function get_story_metadata_from_node_data(node_data) {
  const chapters = [];
  const extras = [];
  if (node_data.bm) {
    for (const chapter of node_data.bm) {
      const raw_title = chapter.title || "";
      const is_special_chapter = raw_title.startsWith("#special ");
      const title = is_special_chapter
        ? raw_title.substring("#special ".length)
        : raw_title;
      const chapter_data = {
        title: title,
        raw_file_name: `chapter_${chapter.id}`,
        output_file_name: is_special_chapter
          ? `appendix${extras.length + 1}`
          : `ch${chapters.length + 1}`,
        is_appendix: is_special_chapter,
      };
      if (is_special_chapter) {
        extras.push(chapter_data);
      } else {
        chapters.push(chapter_data);
      }
    }
  }
  return {
    title: node_data.t || "",
    chapter_metadata: chapters.concat(extras),
  };
}

/**
 * Generate the contents of a chapter from the chapter data
 * @param {utils.NodeChapterDataList} chapter_data The raw chapter data downloaded from ficlive
 * @param {{ include_polls?: boolean, include_writeins?: boolean }} [options] The options for generating the contents
 * @returns {string[]} The chapter content as a list of HTML fragments
 */
function create_html_fragments_from_chapter(chapter_data, options) {
  options = options || { include_polls: false, include_writeins: false };
  let fragments = [];
  for (const entry of chapter_data) {
    if (entry.t && entry.t.startsWith("#special") && chapter_data.length > 1)
      continue;
    if (entry.nt === "chapter") {
      fragments.push(entry.b);
      continue;
    }
    if (entry.nt === "readerPost" && entry.votes && options.include_writeins) {
      let result = "<h3>Reader Posts</h3>";
      for (const vote of Object.values(entry.votes)) {
        result += vote;
        result += "<hr>\n";
      }

      result += "<hr>\n";
      fragments.push(result);
      continue;
    }
    if (entry.nt === "choice" && entry.votes && options.include_polls) {
      const choices = entry.choices.map((choice) => ({
        text: choice,
        votes: 0,
      }));
      if (entry.multiple) {
        for (const vote_list of Object.values(entry.votes).concat(
          Object.values(entry.userVotes || {})
        )) {
          for (const vote of vote_list) {
            choices[vote].votes++;
          }
        }
      } else if (!entry.multiple) {
        for (const vote of Object.values(entry.votes).concat(
          Object.values(entry.userVotes || {})
        )) {
          choices[vote].votes++;
        }
      }
      choices.sort((a, b) => b.votes - a.votes);
      let result = `<h3>Poll:</h3>\n`;
      result += "<ul>\n";
      for (let index = 0; index < choices.length; index++) {
        const choice = choices[index];
        if (choice.text === "permanentlyRemoved") continue;
        if (entry.xOut && entry.xOut.some((s) => s === `${index}`)) {
          result += `<li><span style="text-decoration: line-through;">${choice.text}</span> (${choice.votes} votes)</li>\n`;
        } else {
          result += `<li>${choice.text} (${choice.votes} votes)</li>\n`;
        }
      }
      result += "</ul>\n";
      fragments.push(result);
      continue;
    }
  }
  return fragments;
}

/**
 * Generate the HTML files of a ficlive story
 * @param {string} folder_name The name of the story to download
 * @param {{ include_polls?: boolean, include_writeins?: boolean }} fragment_options The options to use when generating fragments
 * @param {{ show_output?: boolean, }} [options] The options for generating the contents
 */
module.exports.analyze_story_data = async function (
  folder_name,
  fragment_options,
  options
) {
  options = options || { show_output: false };
  fragment_options = fragment_options || {
    include_polls: false,
    include_writeins: false,
  };

  const raw_directory_path = `${utils.paths.download}/${folder_name}`;
  const node_data = await utils.read_json_file(
    `${raw_directory_path}/node.json`
  );
  const story_metadata = get_story_metadata_from_node_data(node_data);
  if (options.show_output)
    console.log(
      `${folder_name} - Found data for ${story_metadata.chapter_metadata.length} chapters`
    );

  await utils.ensure_directory(utils.paths.analyze);
  await utils.delete_file_if_exists(
    `${utils.paths.analyze}/${folder_name}.json`
  );

  /** @type {utils.StoryData} */
  const story_data = {
    title: story_metadata.title,
    chapters: [],
  };

  for (let index = 0; index < story_metadata.chapter_metadata.length; index++) {
    const chapter_metadata = story_metadata.chapter_metadata[index];
    /** @type {utils.NodeChapterDataList} */
    const raw_chapter_data = await utils.read_json_file(
      `${raw_directory_path}/${chapter_metadata.raw_file_name}.json`
    );
    const html_fragments = create_html_fragments_from_chapter(
      raw_chapter_data,
      fragment_options
    );
    const previous_file =
      index > 0
        ? story_metadata.chapter_metadata[index - 1].output_file_name
        : "index";
    const next_file =
      index < story_metadata.chapter_metadata.length - 1
        ? story_metadata.chapter_metadata[index + 1].output_file_name
        : "index";
    story_data.chapters.push({
      title: chapter_metadata.title,
      is_appendix: chapter_metadata.is_appendix,
      raw_file_name: chapter_metadata.raw_file_name,
      output_file_name: chapter_metadata.output_file_name,
      previous_file: previous_file,
      next_file: next_file,
      fragments: html_fragments,
    });
    if (options.show_output)
      console.log(
        `${folder_name} - Created ${html_fragments.length} fragments for chapter ${chapter_metadata.title}`
      );
  }

  await utils.write_json_file(
    `${utils.paths.analyze}/${folder_name}.json`,
    story_data
  );
};

/**
 * @param {string} folder_name
 */
module.exports.get_word_count_per_chapter = async function (folder_name) {
  /** @type {utils.StoryData} */
  const story_data = await utils.read_json_file(
    `${utils.paths.analyze}/${folder_name}.json`
  );
  let total_without_appendix = 0;
  let total_with_appendix = 0;
  for (const chapter of story_data.chapters) {
    let chapter_word_count = 0;
    for (const fragment of chapter.fragments) {
      let data = fragment;
      data = data.replace(/<[^>]*>/g, " ");
      data = data.replace(/\s+/g, " ");
      data = data.trim();
      chapter_word_count += data.split(" ").length;
    }
    console.log(`Chapter ${chapter.title} - word count: ${chapter_word_count}`);
    if (!chapter.is_appendix) total_without_appendix += chapter_word_count;
    total_with_appendix += chapter_word_count;
  }
  console.log(`Total without appendix: ${total_without_appendix}`);
  console.log(`Total with appendix: ${total_with_appendix}`);
};
