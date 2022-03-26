//@ts-check
const utils = require("./utils");

/**
 * Generates the HTML for the "index.html" page.
 * @param {utils.StoryData} story_data The list of chapter metadata
 * @returns {string} The generated HTML
 */
function generate_full_index_html_from_chapter_metadata(story_data) {
  const chapters = story_data.chapters
    .filter((m) => !m.is_appendix)
    .map((m) => `<a href="${m.output_file_name}.html">${m.title}</a>`)
    .join("<br />");
  const appendixes = story_data.chapters
    .filter((m) => m.is_appendix)
    .map((m) => `<a href="${m.output_file_name}.html">${m.title}</a>`)
    .join("<br />");
  return `<!DOCTYPE html>
<html>
    <head>
        <title>Index</title>
        <meta charset="utf-8">
        <style>
            body {
                color: #ddd;
                background-color: #222;
                font-size: 22px;
            }
            body > article {
                margin: 20px auto;
                max-width: 750px;
            }
            a, a:visited {
                color: #ddd;
            }
        </style>
    </head>
    <body>
        <article>
            <h2>Index</h2>
            ${chapters}
            <hr>
            <h2>Appendixes</h2>
            ${appendixes}
        </article>
    </body>
</html>`;
}

/**
 * Generate the overall HTML page for a chapter's data
 * @param {utils.ChapterData} chapter The chapter data
 * @returns {string} The HTML data to generate for the webpage as a whole
 */
function generate_full_chapter_html_from_chapter_fragments(chapter) {
  return `<!DOCTYPE html>
<html>
    <head>
        <title>${chapter.title}</title>
        <meta charset="utf-8">
        <style>
            body {
                color: #ddd;
                background-color: #111;
                font-size: 22px;
            }
            body > article {
                margin: 20px auto;
                max-width: 750px;
                text-align: justify;
                line-height: 1.6;
            }
            nav.chapter_navigation {
                display: flex;
                align-content: center;
                justify-content: center;
            }
            nav.chapter_navigation a {
                border-color: #555;
                background-color: #444;
                flex-grow: 1;
                flex-shrink: 0;
                max-width: 200px;
                border-style: solid;
                border-width: 2px;
                text-align: center;
            }
            .chapter-footer {
                display: none;
            }
            a, a:visited {
                color: #ddd;
            }
        </style>
    </head>
    <body>
        <nav class="chapter_navigation">
        <a href="${chapter.previous_file}.html">&lt; Previous</a>
        <a href="index.html">Index</a>
        <a href="${chapter.next_file}.html">Next &gt;</a>
        </nav>
        <article>
            <h2>${chapter.title}</h2>
            ${chapter.fragments
              .map((f) => `<section>${f}</section>`)
              .join("\n")}
        </article>
        <nav class="chapter_navigation">
            <a href="${chapter.previous_file}.html">&lt; Previous</a>
            <a href="${chapter.next_file}.html">Next &gt;</a>
        </nav>
    </body>
</html>`;
}

/**
 * Generate the HTML for a pre-analyzed story data
 * @param {string} folder_name The short name of the story to generate HTML for (used for file and folder names)
 * @param {{ show_output: boolean }} options The options to use
 */
module.exports.generate_html_for_story_data = async function (
  folder_name,
  options
) {
  options = options || { show_output: false };

  /** @type {utils.StoryDataWithImages} */
  const story_data = await utils.read_json_file(
    `${utils.paths.images}/${folder_name}.json`
  );

  const output_directory_path = `${utils.paths.output}/${folder_name}`;
  await utils.ensure_directory(output_directory_path);

  const index_html = generate_full_index_html_from_chapter_metadata(story_data);
  await utils.delete_file_if_exists(`${output_directory_path}/index.html`);
  if (options.show_output)
    console.log(`Creating ${output_directory_path}/index.html`);
  await utils.write_raw_file(`${output_directory_path}/index.html`, index_html);
  for (const chapter_data of story_data.chapters) {
    await utils.delete_file_if_exists(
      `${output_directory_path}/${chapter_data.output_file_name}.html`
    );
    if (options.show_output)
      console.log(
        `Creating ${output_directory_path}/${chapter_data.output_file_name}.html`
      );
    const chapter_html =
      generate_full_chapter_html_from_chapter_fragments(chapter_data);
    await utils.write_raw_file(
      `${output_directory_path}/${chapter_data.output_file_name}.html`,
      chapter_html
    );
  }
};
