# Ficlive downloader

## Prerequisites

Any version of node.js (tested with v16.9.0), but anything would work

## How to run

- Get the list of stories and node IDs you want to download
  - The node ID is the one towards the end of the URL, right after the story name and right before the chapter name
  - For example, in `https://fiction.live/stories/Fiction-live-Scripting-Guide/pJSFhShedzWhiaXQN/home`, the node ID is `pJSFhShedzWhiaXQN`
- Change the list of stories you want to download
  - Edit the "script.js" file to change the content right after `const story_list = [`
  - Entries have the format `{ folder_name: "ficlive_scripting", node_id: "pJSFhShedzWhiaXQN" }`
  - Your `folder_name` will be the name of the folder to use, so you want something that matches a folder's name
  - You can optionally add `include_polls: true` and/or `include_writeins: true` to include the polls or writeins in the final output
  - For example: `{ folder_name: "ficlive_scripting", node_id: "pJSFhShedzWhiaXQN", include_writeins: true }`
- Run the script using `node script.js`
  - You might need to wait a while. There's timeout after each request in order not to DOS fiction.live
  - Each "download" takes 2 to 3 seconds
  - If the script crashes or something, thankfully you don't need to wait again (data from the website gets cached when we retrieve it)
- Open your story's local webpage in `stories/[your folder name]/index.html`!

## Random development notes

- Fiction.live API URLs to use when retrieving data:
  - `https://fiction.live/api/node/[NODE_ID]`
    - This lists all of the chapters (I call it "node data" throughout the code)
  - `https://fiction.live/api/anonkun/chapters/[NODE_ID]/[TIMESTAMP_START_INCLUDED]/[TIMESTAMP_END_INCLUDED]`
    - This lists the actual story contents
- Notes about "node data" and timestamps
  - The node data lists the chapter's "start timestamp"
  - In order to get one chapter's data, you want to match the start/end of the timestamp, so basically [this chapter] => [next chapter - 1].
  - For the last chapter, it should end at "9999999999999998". Note that this doesn't fit in a JS value, but I'm using 999999999999998 (one less 9 than the expected one) and it works just fine
  - If you thought "hey I could just download the 0/9999999999999998 and it'd work to get all the data at once, right?" then no. Ficlive doesn't like that request on bug stories, and it tends to return nothing or lag a lot or sometimes both.
  - Some chapters start with `#special` and only have one "entry". You don't want to use them in ranges, you just want to say `[timestamp]/[timestamp]` and be done with it
  - You might get the results of these "special" chapters during other normal chapters, so you want to ignore them at display time
- Notes about images
  - Most images are just that, images. I download them cuz the goal is full offline
  - There's one URL that was used early on which is `www.filepicker.io/api/file/SOME_ID`. That isn't an image's URL
  - You need to manually replace this one with `cdn4.fiction.live/fp/THE_SAME_ID?height=600&width=800&quality=95`
  - Not sure if another size / quality value could work in this URL, but it works as-is for me and I don't need it bigger
