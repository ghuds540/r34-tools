- native host that can store persistent data
  - seen/hidden posts
  - downloaded posts (deduplication)
    - add options to still show/hide these in results
  - bookmarked page deduplication and retrieval to persist between sessions (fill in bookmark solid color)
- fix some posts not auto forcing higher quality
- hotkeys for next/last page
- for posts that have parent/child posts, add a "download collection" button
- temporary session storage track bookmark to show if saved
- maybe enable option for thumbnail size label to show the true underlying media dimensions and not just the preview

- ability to turn off/on sounds at fine grain

long game:
- visual sorting stuff (auto adds score:ascending, etc)
- easily bookmark actual posts for later from hover
- starred/hearted tags/artists,etc

small easy fixes:
- in extension popup dont show downloads unless on rule34.xxx in relevant apage
- cleanup the layout of the extension options page, some things like auto pause should be in the same section as auto play videos on post pages

small features:
- settings icon in top bar or sidebar to bring to extension settings
- hide tag search previous/next
  - add keyboard shortcuts for them
- force always view original (private browsing makes you reset usually)
- download whole page (needs 429 retry first)

- enhanced sorting
  - easy score filtering
  - arrow flip flop up down for recency
  - might be configurable in settings
- saved searches in dropdown filter list
  - need to wait for sqlite for this 

- experiment with rate limit bypassing or techniques that make it faster/more efficient

medium/large features:
- tiktok

optional score on hover
- make some of the options for hover just be permentant (ytou can choose for each thing to be either off, hover, always on)

experiment with behavior that would circumvent aggressive rate limiting (human interactions where its sporadic and inconsistent seem to make it not rate limit as much, but might just be me)

condense settings and give it a pass to make some things that are implicitely done now into settings

add checkbox in post page

improve performance and rate limiting with lazy retrieval of things,
do a huge efficiency pass optimizing everything

pretty console printout of rule34 tools ascii logo with version.

code refactor

save page other than tag add to database and storage

introduce actions tracking (times downloaded, times seen post, pages saved, videos played, pages visited, times expanded posts, searches, can see stuff over time as well)

could add 7tv style socials to comments and profiles
