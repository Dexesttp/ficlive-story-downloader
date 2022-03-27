# Ficlive downloader

## Prerequisites

Install [node.js](https://nodejs.org/) (tested with v16.9.0, but givent he APIs and code style used, any version should work)

## How to run

- Get the list of stories and node IDs you want to download
  - The node ID is the one towards the end of the URL, right after the story name and right before the chapter name
  - For example, in `https://fiction.live/stories/Fiction-live-Scripting-Guide/pJSFhShedzWhiaXQN/home`, the node ID is `pJSFhShedzWhiaXQN`
- Change the list of stories you want to download
  - Edit the "script.js" file to change the content right after `const story_list = [`
  - Entries have the format `{ folder_name: "ficlive_scripting", node_id: "pJSFhShedzWhiaXQN" }`
  - Your `folder_name` will be the name of the folder to use, so you want something that can be used as a folder name (no special characters, etc...)
  - You can optionally add `include_polls: true` and/or `include_writeins: true` to include the polls or writeins in the final output
  - For example: `{ folder_name: "ficlive_scripting", node_id: "pJSFhShedzWhiaXQN", include_writeins: true }`
- Run your script using `node script.js`
  - You might need to wait a while for it to be done, depending of your story's size.
  - There's a timeout after each request, so each download has a 2 to 3 seconds pause. This is in order not to DOS fiction.live (and stops you from getting rate limited / IP banned).
  - Data from the website gets cached when we retrieve it : if you stop the script (or it crashes), no need to wait the second time
- Open your story's local webpage in `stories/[your folder name]/index.html`!

## Random development notes

- Fiction.live API URLs to use when retrieving data:
  - `https://fiction.live/api/node/[NODE_ID]`
    - This is an object with the title, all of the chapters, and some other stuff like achievements (It's called "node data" in the codebase)
  - `https://fiction.live/api/anonkun/chapters/[NODE_ID]/[TIMESTAMP_START_INCLUDED]/[TIMESTAMP_END_INCLUDED]`
    - This lists the actual story contents in an array (it's called "node type" in the codebase)
- Notes about "node data" and timestamps
  - The node data lists the chapter's "start timestamp"
  - In order to get one chapter's data, you want to match the start/end of the timestamp, so basically [this chapter's timestamp] => [next chapter's timestamp - 1].
  - For the last chapter, it should end at "9999999999999998". Note that this doesn't fit in a JS value, but the script uses 999999999999998 (one less 9 than the expected one) and it works just fine
  - If you thought "hey I could just download the 0/9999999999999998 and it'd work to get all the data at once, right?" then no. Ficlive doesn't like handling that request on big stories (understandably), and it tends to return nothing or lag a lot or sometimes both. Better to stick to specific time ranges just like the front-end does.
  - Some chapters start with `#special` and only have one "entry". You don't want to use them as the "next chapter's timestamp", and you don't want to use its next chapter's timestamp either. Basically, you just ignore them for the "normal chapters" stuff, and to retreiev them you say `[timestamp]/[timestamp]`
  - Note that you _will_ get the results of these "special" chapters during other normal chapters. So, when parsing a normal chapter's results, you want to ignore any node entry that has a `t: "#special something something"` in it because it comes from a special chapter created at that time and isn't part of the actual chapter.
- Notes about images
  - Most images are just that, images. The script downloads them because the goal is a fully offline story, but you could leave them as-is if you wanted
  - There's one known exception, the URL that was used early on which is `www.filepicker.io/api/file/SOME_ID`. That isn't an image's URL, but an API's url.
  - The script replaces this URL with `cdn4.fiction.live/fp/THE_SAME_ID?height=600&width=800&quality=95`
  - Not sure if another size / quality value could work in this URL, but it works as-is for sure so might as well
