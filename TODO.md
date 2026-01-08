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

default video volume might not be setting unless we have auto play thing on

handle gateway timeouts with backoff

batch download page not displaying the "loading" and checks properly (no checks at all). seems to also be hiding some notifications about what its doing, and when i changed pages and then came back it appeared to not complete the original page, but maybe that was just a rate limit backoff thing

heart tags and artists. "follow" artists and there is a following feed that displays only things tagged by artists you follow

resolution is gone from search page entries!

when you focus tab, re-check all of the saved post and tag bookmarks to update visually

when i click download all it doesnt mark them as it goes i have to refresh

queue stuff is really buggy and broken, ton of edge cases where it will incrememnt left side but not right or increment wrong, i also feel like the persist logic seems wrong because it feels shaky to start downloads and then close tab or switch pages

bug on accounts like dagasi post page first image which is advertisement gets the hover stuff not the real post
